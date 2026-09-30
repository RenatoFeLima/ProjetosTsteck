// @vitest-environment node
// Regressão administrativa de status (servidor + rotas).
// Banco em memória com $transaction REAL (snapshot/rollback), falha injetável
// por operação e sequência de eventos — o mesmo padrão do Backlog P.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { SessionUser } from "@/server/auth/session";
import type { UserRole } from "@/features/auth/lib/auth-types";
import { HttpError } from "@/server/auth/guards";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const h = vi.hoisted(() => {
  const state = {
    db: {} as Record<string, Record<string, any>[]>,
    failOn: null as string | null,
    events: [] as string[],
    insideTx: null as null | (() => void),
    seq: 0,
    session: null as unknown,
  };
  function matches(row: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && !(v instanceof Date) && "not" in v) return row[k] !== v.not;
      return row[k] === v;
    });
  }
  function applyData(row: Row, data: Row) {
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === "object" && !(v instanceof Date) && "increment" in v) row[k] = (row[k] ?? 0) + v.increment;
      else row[k] = v;
    }
  }
  function pick(row: Row | undefined, select?: Row) {
    if (!row) return null;
    if (!select) return { ...row };
    return Object.fromEntries(Object.keys(select).map((k) => [k, row[k]]));
  }
  function check(op: string) {
    if (state.failOn === op) throw new Error(`falha simulada em ${op}`);
  }
  function table(name: string) {
    const rows = () => state.db[name];
    return {
      findUnique: async ({ where, select }: Row) => {
        state.events.push(`${name}.findUnique`);
        return pick(rows().find((r) => matches(r, where)), select);
      },
      findFirst: async ({ where, select }: Row) => pick(rows().find((r) => matches(r, where)), select),
      findUniqueOrThrow: async ({ where }: Row) => {
        const r = rows().find((x) => matches(x, where));
        if (!r) throw new Error("not found");
        return { ...r, builder: { name: "CONSTRUTORA X" }, work: { name: "OBRA Y" }, seller: { id: "s1", name: "VENDEDOR", email: "v@tsteck.local" } };
      },
      create: async ({ data }: Row) => {
        check(`${name}.create`);
        const row = { id: `${name}-${++state.seq}`, createdAt: new Date(), ...data };
        rows().push(row);
        state.events.push(`${name}.create`);
        return row;
      },
      updateMany: async ({ where, data }: Row) => {
        check(`${name}.updateMany`);
        const hit = rows().filter((r) => matches(r, where));
        hit.forEach((r) => applyData(r, data));
        state.events.push(`${name}.updateMany`);
        return { count: hit.length };
      },
      upsert: async ({ where, create, update }: Row) => {
        const r = rows().find((x) => matches(x, where));
        if (r) applyData(r, update);
        else rows().push({ id: `${name}-${++state.seq}`, ...create });
        state.events.push(`${name}.upsert`);
      },
    };
  }
  const TABLES = [
    "project",
    "projectStatusHistory",
    "projectReviewStudyHistory",
    "projectFinalReviewHistory",
    "projectObservation",
    "auditLog",
    "projectNotification",
    "seller",
  ];
  const prismaFake: Row = Object.fromEntries(TABLES.map((t) => [t, table(t)]));
  prismaFake.$transaction = async (fn: (tx: Row) => Promise<unknown>) => {
    state.insideTx?.();
    const snapshot = structuredClone(state.db);
    state.events.push("tx:begin");
    try {
      const out = await fn(prismaFake);
      state.events.push("tx:commit");
      return out;
    } catch (e) {
      state.db = snapshot;
      state.events.push("tx:rollback");
      throw e;
    }
  };
  return { state, prismaFake };
});
const S = h.state;

vi.mock("@/lib/db/prisma", () => ({ prisma: h.prismaFake }));
const mail = vi.hoisted(() => ({ sendProjectMovementEmail: vi.fn(), sendProjectCreatedEmail: vi.fn() }));
vi.mock("@/lib/mail/mail-service", () => mail);
vi.mock("@/server/auth/csrf", () => ({ requireSameOrigin: vi.fn() }));
vi.mock("@/server/auth/session", async (orig) => ({
  ...(await orig<typeof import("@/server/auth/session")>()),
  getSession: vi.fn(async () => h.state.session),
}));

import { changeStatus, regressStatus } from "@/server/services/projectService";
import { POST as regressionRoute } from "@/app/api/projects/[id]/status-regression/route";
import { POST as statusRoute } from "@/app/api/projects/[id]/status/route";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeUser(role: UserRole, patch?: (p: ReturnType<typeof getDefaultPermissions>) => void): SessionUser {
  const permissions = structuredClone(getDefaultPermissions(role));
  patch?.(permissions);
  return {
    id: `u-${role}`,
    username: role.toLowerCase(),
    name: `Usuário ${role}`,
    email: null,
    role,
    active: true,
    mustChangePassword: false,
    permissions,
    lastLoginAt: null,
    sellerIds: role === "SELLER" ? ["s1"] : [],
  };
}
const ADMIN = makeUser("ADMIN");
const NON_ADMINS: Array<[string, SessionUser]> = [
  ["PROJECTS", makeUser("PROJECTS")],
  ["MANAGER", makeUser("MANAGER")],
  ["CUSTOM com projects.changeStatus", makeUser("CUSTOM", (p) => { p.projects.edit = true; p.projects.changeStatus = true; })],
  ["SELLER", makeUser("SELLER")],
  ["COMMERCIAL", makeUser("COMMERCIAL")],
  ["VIEWER", makeUser("VIEWER")],
];

const OLD = new Date("2026-01-10T12:00:00.000Z");
const ALIGNED_AT = new Date("2025-12-01T00:00:00.000Z");
const IMPORTED_DEADLINE = new Date("2026-03-01T00:00:00.000Z");
const URGENT_DEADLINE = new Date("2026-02-20T00:00:00.000Z");
const REASON = "Cliente solicitou revisão do ante-projeto após aprovação.";

function seed(status: string, over: Row = {}) {
  S.db = {
    project: [
      {
        id: "p1",
        code: "CRE-ABC-2051",
        status,
        sellerId: "s1",
        priority: "URGENTE",
        urgentDeadline: URGENT_DEADLINE,
        urgentReason: "obra antecipada",
        projectReceived: true,
        cabinLocationDefined: true,
        alignmentCompleted: true,
        alignmentDate: ALIGNED_AT,
        currentStatusEnteredAt: OLD,
        deadline: IMPORTED_DEADLINE,
        reviewStudyCount: 2,
        finalReviewCount: 1,
        updatedById: null,
        createdAt: OLD,
        updatedAt: OLD,
        ...over,
      },
    ],
    projectStatusHistory: [
      { id: "h0", projectId: "p1", fromStatus: null, toStatus: "CADASTRO_INICIAL", enteredAt: OLD, exitedAt: OLD, source: "sistema", note: null },
      { id: "h1", projectId: "p1", fromStatus: "CADASTRO_INICIAL", toStatus: status, enteredAt: OLD, exitedAt: null, source: "kanban", note: null },
    ],
    projectReviewStudyHistory:
      status === "REVISAO_DE_ESTUDO" ? [{ id: "rs1", projectId: "p1", enteredAt: OLD, exitedAt: null, reason: "cliente pediu" }] : [],
    projectFinalReviewHistory:
      status === "REVISAO_DE_PROJETO_FINAL" ? [{ id: "rf1", projectId: "p1", enteredAt: OLD, exitedAt: null, reason: "cliente pediu" }] : [],
    projectObservation: [{ id: "o1", projectId: "p1", author: "Alguém", text: "observação antiga", createdAt: OLD }],
    auditLog: [],
    projectNotification: [],
    seller: [{ id: "s1", name: "VENDEDOR", email: "v@tsteck.local", active: true }],
  };
}
const project = () => S.db.project[0];
const newHistory = () => S.db.projectStatusHistory.filter((r) => r.id !== "h0" && r.id !== "h1");
const audits = () => S.db.auditLog.filter((a) => a.action === "ADMIN_STATUS_REGRESSION");

async function expectHttp(p: Promise<unknown>, status: number) {
  const err = await p.then(
    () => null,
    (e) => e,
  );
  expect(err).toBeInstanceOf(HttpError);
  expect((err as HttpError).status).toBe(status);
  return err as HttpError;
}

beforeEach(() => {
  vi.clearAllMocks();
  S.failOn = null;
  S.events = [];
  S.insideTx = null;
  S.session = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
  mail.sendProjectMovementEmail.mockResolvedValue({ success: true, message: "ok" });
});

// ─── ADMIN: regressões válidas ──────────────────────────────────────────────────

describe("ADMIN — regressão válida a partir de cada ponto do fluxo", () => {
  it.each([
    ["PROJETO_APROVADO", "ANTE-PROJETO ENVIADO", "ANTE_PROJETO_ENVIADO"],
    ["PROJETO_APROVADO", "PROJETO FINAL ENVIADO", "PROJETO_FINAL_ENVIADO"],
    ["PROJETO_FINAL_ENVIADO", "ANTE-PROJETO APROVADO", "ANTE_PROJETO_APROVADO"],
    ["ANTE_PROJETO_APROVADO", "ANTE-PROJETO ENVIADO", "ANTE_PROJETO_ENVIADO"],
    ["REVISAO_DE_PROJETO_FINAL", "ANTE-PROJETO APROVADO", "ANTE_PROJETO_APROVADO"],
    ["REVISAO_DE_ESTUDO", "ELABORAR ANTE-PROJETO", "ELABORAR_ANTE_PROJETO"],
  ])("%s → %s", async (from, toUi, toDb) => {
    seed(from);
    const out = await regressStatus(ADMIN, "p1", toUi, `  ${REASON}  `);

    expect(out.status_atual).toBe(toUi);
    expect(project().status).toBe(toDb);
    expect(project().currentStatusEnteredAt.getTime()).toBeGreaterThan(OLD.getTime());
    expect(project().updatedById).toBe(ADMIN.id);

    // Histórico: o aberto é fechado, nada é apagado, um evento novo é criado.
    expect(S.db.projectStatusHistory.find((r) => r.id === "h1")!.exitedAt).toBeInstanceOf(Date);
    expect(S.db.projectStatusHistory.find((r) => r.id === "h0")).toBeDefined();
    expect(newHistory()).toHaveLength(1);
    expect(newHistory()[0]).toMatchObject({
      fromStatus: from,
      toStatus: toDb,
      source: "admin_regression",
      note: REASON,
      changedById: ADMIN.id,
    });
    expect(newHistory()[0].exitedAt ?? null).toBeNull(); // o novo evento fica aberto

    // Observação visível no drawer (a antiga continua).
    expect(S.db.projectObservation).toHaveLength(2);
    expect(S.db.projectObservation[1]).toMatchObject({ author: ADMIN.name });
    expect(S.db.projectObservation[1].text).toContain("Regressão administrativa de status");
    expect(S.db.projectObservation[1].text).toContain(REASON);

    // Auditoria com os campos pedidos, gravada DENTRO da transação.
    expect(audits()).toHaveLength(1);
    expect(audits()[0]).toMatchObject({
      actorUserId: ADMIN.id,
      actorName: ADMIN.name,
      entityType: "project",
      entityId: "p1",
      metadataJson: { projectCode: "CRE-ABC-2051", toStatus: toUi, reason: REASON },
    });
    expect(audits()[0].createdAt).toBeInstanceOf(Date);
    const ev = S.events;
    expect(ev.indexOf("auditLog.create")).toBeGreaterThan(ev.indexOf("tx:begin"));
    expect(ev.indexOf("auditLog.create")).toBeLessThan(ev.indexOf("tx:commit"));
  });

  it("preserva código, urgência, prioridade, contadores, prazo importado e data de alinhamento", async () => {
    seed("PROJETO_APROVADO");
    await regressStatus(ADMIN, "p1", "ANTE-PROJETO ENVIADO", REASON);
    expect(project()).toMatchObject({
      code: "CRE-ABC-2051",
      priority: "URGENTE",
      urgentDeadline: URGENT_DEADLINE,
      urgentReason: "obra antecipada",
      reviewStudyCount: 2,
      finalReviewCount: 1,
      deadline: IMPORTED_DEADLINE,
      alignmentDate: ALIGNED_AT,
      projectReceived: true,
      cabinLocationDefined: true,
      alignmentCompleted: true,
    });
  });

  it("aceita o destino também no formato do banco", async () => {
    seed("PROJETO_APROVADO");
    await regressStatus(ADMIN, "p1", "ANTE_PROJETO_APROVADO", REASON);
    expect(project().status).toBe("ANTE_PROJETO_APROVADO");
  });

  it("ZERO e-mail e nenhuma notificação registrada", async () => {
    seed("ELABORAR_ANTE_PROJETO");
    await regressStatus(ADMIN, "p1", "CADASTRO INICIAL", REASON);
    seed("PROJETO_APROVADO");
    await regressStatus(ADMIN, "p1", "PROJETO FINAL ENVIADO", REASON);
    expect(mail.sendProjectMovementEmail).not.toHaveBeenCalled();
    expect(mail.sendProjectCreatedEmail).not.toHaveBeenCalled();
    expect(S.db.projectNotification).toEqual([]);
    expect(S.events.some((e) => e.startsWith("projectNotification"))).toBe(false);
  });
});

describe("revisões como origem", () => {
  it("Revisão de Estudo: fecha o ciclo aberto e não abre outro nem mexe no contador", async () => {
    seed("REVISAO_DE_ESTUDO");
    await regressStatus(ADMIN, "p1", "ELABORAR ANTE-PROJETO", REASON);
    expect(S.db.projectReviewStudyHistory).toHaveLength(1);
    expect(S.db.projectReviewStudyHistory[0].exitedAt).toBeInstanceOf(Date);
    expect(project().reviewStudyCount).toBe(2);
  });

  it("Revisão de Projeto Final: fecha o ciclo aberto e não abre outro nem mexe no contador", async () => {
    seed("REVISAO_DE_PROJETO_FINAL");
    await regressStatus(ADMIN, "p1", "ANTE-PROJETO ENVIADO", REASON);
    expect(S.db.projectFinalReviewHistory).toHaveLength(1);
    expect(S.db.projectFinalReviewHistory[0].exitedAt).toBeInstanceOf(Date);
    expect(project().finalReviewCount).toBe(1);
    expect(S.db.projectReviewStudyHistory).toEqual([]);
  });
});

describe("destino Cadastro Inicial", () => {
  it("desmarca só 'Alinhamento concluído', preserva o resto e registra na auditoria", async () => {
    seed("PROJETO_APROVADO");
    await regressStatus(ADMIN, "p1", "CADASTRO INICIAL", REASON);
    expect(project()).toMatchObject({
      status: "CADASTRO_INICIAL",
      alignmentCompleted: false,
      projectReceived: true,
      cabinLocationDefined: true,
      alignmentDate: ALIGNED_AT,
    });
    expect(audits()[0].metadataJson).toMatchObject({
      alignmentReset: true,
      alignmentCompleted: { from: true, to: false },
    });
    expect(S.db.projectObservation[1].text).toContain("Alinhamento concluído marcado como pendente novamente");
  });

  it("alinhamento já pendente: nada a desmarcar, sem alignmentReset na auditoria", async () => {
    seed("ELABORAR_ANTE_PROJETO", { alignmentCompleted: false });
    await regressStatus(ADMIN, "p1", "CADASTRO INICIAL", REASON);
    expect(project().alignmentCompleted).toBe(false);
    expect(audits()[0].metadataJson).not.toHaveProperty("alignmentReset");
  });

  it("outros destinos não mexem no alinhamento", async () => {
    seed("PROJETO_APROVADO");
    await regressStatus(ADMIN, "p1", "ELABORAR ANTE-PROJETO", REASON);
    expect(project().alignmentCompleted).toBe(true);
    expect(audits()[0].metadataJson).not.toHaveProperty("alignmentReset");
  });
});

describe("destino com SLA (Elaborar)", () => {
  it("currentStatusEnteredAt = agora e o prazo explícito importado é preservado", async () => {
    seed("ANTE_PROJETO_APROVADO");
    const before = Date.now();
    await regressStatus(ADMIN, "p1", "ELABORAR ANTE-PROJETO", REASON);
    expect(project().currentStatusEnteredAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(project().deadline).toEqual(IMPORTED_DEADLINE);
  });
});

// ─── Autorização ────────────────────────────────────────────────────────────────

describe("não ADMIN — 403 antes de qualquer leitura, sem efeitos", () => {
  it.each(NON_ADMINS)("%s", async (_label, user) => {
    seed("PROJETO_APROVADO");
    const before = structuredClone(S.db);
    await expectHttp(regressStatus(user, "p1", "ANTE-PROJETO ENVIADO", REASON), 403);
    expect(S.db).toEqual(before);
    expect(S.events).toEqual([]); // nem o findUnique do projeto
  });

  it("não ADMIN com payload inválido continua recebendo 403 (não 400)", async () => {
    seed("PROJETO_APROVADO");
    await expectHttp(regressStatus(makeUser("PROJECTS"), "p1", 123 as unknown as string, ""), 403);
  });
});

// ─── Payload adulterado / validação ─────────────────────────────────────────────

describe("destino e motivo inválidos — 400 sem efeitos", () => {
  it.each([
    ["status atual", "PROJETO_APROVADO", "PROJETO APROVADO"],
    ["status futuro", "ANTE_PROJETO_ENVIADO", "PROJETO APROVADO"],
    ["avanço de uma etapa", "ANTE_PROJETO_APROVADO", "PROJETO FINAL ENVIADO"],
    ["revisão como destino", "PROJETO_APROVADO", "REVISAO DE ESTUDO"],
    ["revisão final como destino", "PROJETO_APROVADO", "REVISAO DE PROJETO FINAL"],
    ["reenvio normal da revisão", "REVISAO_DE_ESTUDO", "ANTE-PROJETO ENVIADO"],
    ["reenvio normal da revisão final", "REVISAO_DE_PROJETO_FINAL", "PROJETO FINAL ENVIADO"],
    ["Cadastro Inicial não tem destino", "CADASTRO_INICIAL", "CADASTRO INICIAL"],
    ["status inexistente", "PROJETO_APROVADO", "ARQUIVADO"],
  ])("%s", async (_label, from, to) => {
    seed(from);
    const before = structuredClone(S.db);
    await expectHttp(regressStatus(ADMIN, "p1", to, REASON), 400);
    expect(S.db).toEqual(before);
  });

  it.each([
    ["vazio", ""],
    ["só espaços", "      "],
    ["4 caracteres", "abcd"],
    ["501 caracteres", "a".repeat(501)],
    ["não é texto", 12345],
    ["ausente", undefined],
  ])("motivo %s", async (_label, reason) => {
    seed("PROJETO_APROVADO");
    const before = structuredClone(S.db);
    await expectHttp(regressStatus(ADMIN, "p1", "ANTE-PROJETO ENVIADO", reason), 400);
    expect(S.db).toEqual(before);
  });

  it.each([
    ["5 caracteres", "abcde"],
    ["500 caracteres", "a".repeat(500)],
  ])("motivo no limite (%s) é aceito", async (_label, reason) => {
    seed("PROJETO_APROVADO");
    await regressStatus(ADMIN, "p1", "ANTE-PROJETO ENVIADO", reason);
    expect(newHistory()[0].note).toBe(reason);
  });

  it("projeto inexistente → 404", async () => {
    seed("PROJETO_APROVADO");
    await expectHttp(regressStatus(ADMIN, "nao-existe", "ANTE-PROJETO ENVIADO", REASON), 404);
  });
});

// ─── Concorrência e falha ───────────────────────────────────────────────────────

describe("concorrência e falha", () => {
  it("status mudou entre a leitura e a transação → 409, nada da regressão permanece", async () => {
    seed("PROJETO_APROVADO");
    S.insideTx = () => {
      project().status = "PROJETO_FINAL_ENVIADO";
      S.insideTx = null;
    };
    await expectHttp(regressStatus(ADMIN, "p1", "ANTE-PROJETO ENVIADO", REASON), 409);
    expect(project().status).toBe("PROJETO_FINAL_ENVIADO");
    expect(newHistory()).toEqual([]);
    expect(S.db.projectObservation).toHaveLength(1);
    expect(S.db.auditLog).toEqual([]);
  });

  it("segundo envio igual (duplo submit que passou) → 400, sem segundo registro", async () => {
    seed("PROJETO_APROVADO");
    await regressStatus(ADMIN, "p1", "ANTE-PROJETO ENVIADO", REASON);
    await expectHttp(regressStatus(ADMIN, "p1", "ANTE-PROJETO ENVIADO", REASON), 400);
    expect(newHistory()).toHaveLength(1);
    expect(audits()).toHaveLength(1);
  });

  it.each(["auditLog.create", "projectObservation.create", "projectStatusHistory.create"])(
    "falha em %s → rollback completo: status intacto, sem histórico, observação ou auditoria falsa",
    async (op) => {
      seed("PROJETO_APROVADO");
      const before = structuredClone(S.db);
      S.failOn = op;
      await expect(regressStatus(ADMIN, "p1", "ANTE-PROJETO ENVIADO", REASON)).rejects.toThrow(/falha simulada/);
      expect(S.db).toEqual(before);
      expect(S.events).toContain("tx:rollback");
    },
  );
});

// ─── Source reservado na rota normal ────────────────────────────────────────────

describe("changeStatus — 'admin_regression' é reservado", () => {
  it.each([
    ["ADMIN", ADMIN],
    ["PROJECTS", makeUser("PROJECTS")],
  ])("%s: 400 e nenhum histórico falsificado", async (_label, user) => {
    seed("ANTE_PROJETO_ENVIADO");
    const before = structuredClone(S.db);
    await expectHttp(changeStatus(user, "p1", "ANTE-PROJETO APROVADO", { source: "admin_regression" }), 400);
    expect(S.db).toEqual(before);
  });

  it("avanço normal com outra origem segue funcionando", async () => {
    seed("ANTE_PROJETO_ENVIADO");
    await changeStatus(ADMIN, "p1", "ANTE-PROJETO APROVADO", { source: "acao-rapida" });
    expect(project().status).toBe("ANTE_PROJETO_APROVADO");
    expect(newHistory()[0].source).toBe("acao-rapida");
  });
});

// ─── Rotas ──────────────────────────────────────────────────────────────────────

function req(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", origin: "http://localhost", host: "localhost" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}
const ctx = { params: Promise.resolve({ id: "p1" }) };

describe("POST /api/projects/[id]/status-regression", () => {
  it("sem sessão → 401", async () => {
    seed("PROJETO_APROVADO");
    const res = await regressionRoute(req("http://localhost/api/projects/p1/status-regression", { toStatus: "ANTE-PROJETO ENVIADO", reason: REASON }), ctx);
    expect(res.status).toBe(401);
  });

  it.each(NON_ADMINS)("%s → 403 mesmo forjando role/source no payload", async (_label, user) => {
    seed("PROJETO_APROVADO");
    S.session = user;
    const before = structuredClone(S.db);
    const res = await regressionRoute(
      req("http://localhost/api/projects/p1/status-regression", { toStatus: "ANTE-PROJETO ENVIADO", reason: REASON, role: "ADMIN", source: "admin_regression" }),
      ctx,
    );
    expect(res.status).toBe(403);
    expect(S.db).toEqual(before);
  });

  it("ADMIN → 200; source/actor/fromStatus do payload são ignorados", async () => {
    seed("PROJETO_APROVADO");
    S.session = ADMIN;
    const res = await regressionRoute(
      req("http://localhost/api/projects/p1/status-regression", {
        toStatus: "ANTE-PROJETO ENVIADO",
        reason: REASON,
        source: "kanban",
        actor: "outra-pessoa",
        fromStatus: "CADASTRO_INICIAL",
      }),
      ctx,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.project.status_atual).toBe("ANTE-PROJETO ENVIADO");
    expect(newHistory()[0]).toMatchObject({ fromStatus: "PROJETO_APROVADO", source: "admin_regression", changedById: ADMIN.id });
  });

  it("ADMIN sem toStatus → 400", async () => {
    seed("PROJETO_APROVADO");
    S.session = ADMIN;
    const res = await regressionRoute(req("http://localhost/api/projects/p1/status-regression", { reason: REASON }), ctx);
    expect(res.status).toBe(400);
  });
});

describe("POST /api/projects/[id]/status com source admin_regression", () => {
  it("400 e nenhum histórico falsificado", async () => {
    seed("ANTE_PROJETO_ENVIADO");
    S.session = makeUser("PROJECTS");
    const before = structuredClone(S.db);
    const res = await statusRoute(
      req("http://localhost/api/projects/p1/status", { status: "ANTE-PROJETO APROVADO", source: "admin_regression" }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(S.db).toEqual(before);
  });
});
