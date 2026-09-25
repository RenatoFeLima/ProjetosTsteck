// @vitest-environment node
// Backlog W — atomicidade do fluxo de urgência (server-side).
// Mesmo banco em memória do teste do Backlog P: $transaction REAL (rollback ao
// snapshot), falhas injetadas por operação e sequência de eventos para provar
// que o e-mail só sai DEPOIS do commit.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { SessionUser } from "@/server/auth/session";
import type { UserRole } from "@/features/auth/lib/auth-types";
import { HttpError } from "@/server/auth/guards";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
type Tables = Record<string, Row[]>;

const h = vi.hoisted(() => {
  const state = {
    db: {} as Record<string, Record<string, any>[]>,
    failOn: null as string | null,
    events: [] as string[],
    /** Executado ao abrir a transação: simula outra requisição que já comitou. */
    insideTx: null as null | (() => void),
    seq: 0,
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
      findUnique: async ({ where, select }: Row) => pick(rows().find((r) => matches(r, where)), select),
      findFirst: async ({ where, select }: Row) => pick(rows().find((r) => matches(r, where)), select),
      findUniqueOrThrow: async ({ where }: Row) => {
        const r = rows().find((x) => matches(x, where));
        if (!r) throw new Error("not found");
        const seller = state.db.seller.find((s) => s.id === r.sellerId);
        return { ...r, builder: { name: "CONSTRUTORA X" }, work: { name: "OBRA Y" }, seller: seller ? { id: seller.id, name: seller.name, email: seller.email } : null };
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
    // Outra transação que comita entre a leitura e esta transação (já persistida).
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

const mail = vi.hoisted(() => ({
  sendProjectMovementEmail: vi.fn(),
  sendProjectCreatedEmail: vi.fn(),
}));
vi.mock("@/lib/mail/mail-service", () => mail);

import { setUrgency } from "@/server/services/projectService";

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
    sellerId: role === "SELLER" ? "s1" : null,
  };
}
// Perfis padrão com projects.markUrgent: ADMIN e MANAGER (PROJECTS não tem).
const ACTOR = makeUser("ADMIN");

function seed(extra: Row = {}): Tables {
  const at = new Date("2026-09-01T12:00:00.000Z");
  return {
    project: [
      {
        id: "p1",
        code: "CRE-000-0001",
        status: "ELABORAR_ANTE_PROJETO",
        sellerId: "s1",
        priority: "NORMAL",
        urgentDeadline: null,
        urgentReason: null,
        reviewStudyCount: 0,
        finalReviewCount: 0,
        currentStatusEnteredAt: at,
        createdAt: at,
        updatedAt: at,
        ...extra,
      },
    ],
    projectStatusHistory: [{ id: "h0", projectId: "p1", fromStatus: null, toStatus: "ELABORAR_ANTE_PROJETO", enteredAt: at, exitedAt: null }],
    projectReviewStudyHistory: [],
    projectFinalReviewHistory: [],
    projectObservation: [],
    auditLog: [],
    projectNotification: [],
    seller: [{ id: "s1", name: "VENDEDOR UM", email: "vendedor@tsteck.com.br", active: true }],
  };
}
const URGENT = { priority: "URGENTE", urgentDeadline: new Date("2026-10-10T00:00:00.000Z"), urgentReason: "cliente" };

const p1 = () => S.db.project.find((p) => p.id === "p1")!;
const obsTexts = () => S.db.projectObservation.map((o) => o.text);
function state() {
  return structuredClone({
    project: S.db.project,
    history: S.db.projectStatusHistory,
    observations: S.db.projectObservation,
    audit: S.db.auditLog,
    notifications: S.db.projectNotification,
  });
}
async function expectHttp(promise: Promise<unknown>, status: number, message?: RegExp) {
  await expect(promise).rejects.toBeInstanceOf(HttpError);
  await promise.catch((e: HttpError) => {
    expect(e.status).toBe(status);
    if (message) expect(e.message).toMatch(message);
  });
}

beforeEach(() => {
  S.failOn = null;
  S.insideTx = null;
  S.events = [];
  S.seq = 0;
  mail.sendProjectMovementEmail.mockReset().mockImplementation(async () => {
    // Registra a prioridade no MOMENTO do envio (prova de pós-commit).
    S.events.push(`email:${p1().priority}`);
    return { success: true, message: "E-mail enviado com sucesso." };
  });
  mail.sendProjectCreatedEmail.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

// ─── 1–2. Sucesso ─────────────────────────────────────────────────────────────

describe("1. marcar como urgente", () => {
  it("persiste urgência, observação, auditoria e e-mail — cada um uma vez; e-mail após o commit", async () => {
    S.db = seed();
    const out = await setUrgency(ACTOR, "p1", true, "  cliente pediu  ", "2026-10-20");

    expect(out.urgente).toBe(true);
    expect(p1()).toMatchObject({ priority: "URGENTE", urgentReason: "cliente pediu" });
    expect(p1().urgentDeadline).toEqual(new Date("2026-10-20"));
    expect(obsTexts()).toEqual([
      "Marcado como urgente (prazo: 2026-10-20): cliente pediu",
      "Notificacao por e-mail ao vendedor: E-mail enviado com sucesso.",
    ]);
    expect(S.db.auditLog.map((a) => a.action)).toEqual(["PROJECT_MARKED_URGENT"]);
    expect(S.db.projectStatusHistory).toHaveLength(1); // urgência não mexe no histórico de status
    expect(mail.sendProjectMovementEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendProjectMovementEmail.mock.calls[0][1]).toEqual(["vendedor@tsteck.com.br"]);
    expect(mail.sendProjectMovementEmail.mock.calls[0][0]).toMatchObject({
      eventType: "MARKED_URGENT",
      projectCode: "CRE-000-0001",
      newStatus: "ELABORAR ANTE-PROJETO",
      urgencyReason: "cliente pediu",
    });
    expect(S.db.projectNotification).toHaveLength(1);
    expect(S.db.projectNotification[0]).toMatchObject({ type: "URGENCY_MARKED", success: true });
    // Ordem: observação dentro da transação; e-mail só depois do commit, já com URGENTE gravado.
    const ev = S.events;
    expect(ev.indexOf("tx:begin")).toBeLessThan(ev.indexOf("projectObservation.create"));
    expect(ev.indexOf("projectObservation.create")).toBeLessThan(ev.indexOf("tx:commit"));
    expect(ev.indexOf("tx:commit")).toBeLessThan(ev.indexOf("email:URGENTE"));
  });

  it("sem motivo: observação sem motivo e e-mail sem bloco de motivo", async () => {
    S.db = seed();
    await setUrgency(ACTOR, "p1", true, "", "2026-10-20");
    expect(obsTexts()[0]).toBe("Marcado como urgente (prazo: 2026-10-20).");
    expect(mail.sendProjectMovementEmail.mock.calls[0][0].urgencyReason).toBeUndefined();
  });

  it("motivo com HTML chega ao template escapado", async () => {
    S.db = seed();
    await setUrgency(ACTOR, "p1", true, "<b>obra</b> & prazo", "2026-10-20");
    expect(mail.sendProjectMovementEmail.mock.calls[0][0].urgencyReason).toBe("&lt;b&gt;obra&lt;/b&gt; &amp; prazo");
  });

  it("vendedor inativo: não envia e registra 'ignorada' (mesma regra do navegador)", async () => {
    S.db = seed();
    S.db.seller[0].active = false;
    await setUrgency(ACTOR, "p1", true, "x", "2026-10-20");
    expect(mail.sendProjectMovementEmail).not.toHaveBeenCalled();
    expect(obsTexts()[1]).toBe("Notificacao por e-mail ao vendedor: Notificação ignorada: vendedor sem e-mail cadastrado.");
  });
});

describe("2. remover urgência", () => {
  it("limpa urgência/prazo/motivo; 1 observação, 1 auditoria, 1 e-mail", async () => {
    S.db = seed(URGENT);
    const out = await setUrgency(ACTOR, "p1", false);
    expect(out.urgente).toBe(false);
    expect(p1()).toMatchObject({ priority: "NORMAL", urgentDeadline: null, urgentReason: null });
    expect(obsTexts()).toEqual(["Urgência removida.", "Notificacao por e-mail ao vendedor: E-mail enviado com sucesso."]);
    expect(S.db.auditLog.map((a) => a.action)).toEqual(["PROJECT_URGENCY_REMOVED"]);
    expect(mail.sendProjectMovementEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendProjectMovementEmail.mock.calls[0][0]).toMatchObject({ eventType: "URGENCY_REMOVED" });
    expect(S.events.indexOf("tx:commit")).toBeLessThan(S.events.indexOf("email:NORMAL"));
  });
});

// ─── 3–5. Falhas ──────────────────────────────────────────────────────────────

describe("falhas — nada permanece", () => {
  it("3. falha antes da persistência (sem prazo): nada muda", async () => {
    S.db = seed();
    const before = state();
    await expectHttp(setUrgency(ACTOR, "p1", true, "x", undefined), 400, /Informe o prazo de urgência/);
    expect(state()).toEqual(before);
    expect(S.events).not.toContain("tx:begin");
    expect(mail.sendProjectMovementEmail).not.toHaveBeenCalled();
  });

  it("3. projeto aprovado: mesma recusa de antes, nada muda", async () => {
    S.db = seed({ status: "PROJETO_APROVADO" });
    const before = state();
    await expectHttp(setUrgency(ACTOR, "p1", true, "x", "2026-10-20"), 400, /Projetos aprovados não podem ser marcados/);
    expect(state()).toEqual(before);
  });

  it.each([
    ["4. dentro da transação (update da urgência)", "project.updateMany", true],
    ["5. na observação (marcar)", "projectObservation.create", true],
    ["5. na observação (remover)", "projectObservation.create", false],
  ])("%s: rollback completo, 0 auditoria, 0 e-mail", async (_l, op, urgent) => {
    S.db = seed(urgent ? {} : URGENT);
    const before = state();
    S.failOn = op as string;
    await expect(setUrgency(ACTOR, "p1", urgent as boolean, "motivo", "2026-10-20")).rejects.toThrow(/falha simulada/);
    expect(state()).toEqual(before);
    expect(p1().priority).toBe(urgent ? "NORMAL" : "URGENTE");
    expect(obsTexts()).toEqual([]);
    expect(S.db.auditLog).toEqual([]);
    expect(S.db.projectNotification).toEqual([]);
    expect(mail.sendProjectMovementEmail).not.toHaveBeenCalled();
    expect(S.events).toContain("tx:rollback");
  });
});

// ─── 6. Falha no e-mail (pós-commit) ──────────────────────────────────────────

describe("6. falha no e-mail depois do commit", () => {
  it("SMTP falha: urgência confirmada permanece e a falha fica registrada", async () => {
    S.db = seed();
    mail.sendProjectMovementEmail.mockResolvedValue({ success: false, message: "Falha SMTP: timeout" });
    const out = await setUrgency(ACTOR, "p1", true, "x", "2026-10-20");
    expect(out.urgente).toBe(true);
    expect(obsTexts()[1]).toBe("Notificacao por e-mail ao vendedor: Falha SMTP: timeout");
    expect(S.db.projectNotification[0]).toMatchObject({ success: false, errorMessage: "Falha SMTP: timeout" });
  });

  it("envio lança exceção: setUrgency não falha nem desfaz", async () => {
    S.db = seed();
    mail.sendProjectMovementEmail.mockRejectedValue(new Error("SMTP caiu"));
    const out = await setUrgency(ACTOR, "p1", true, "x", "2026-10-20");
    expect(out.urgente).toBe(true);
    expect(obsTexts()[1]).toBe("Notificacao por e-mail ao vendedor: Falha ao enviar e-mail (registrada, fluxo não afetado).");
  });
});

// ─── 7–8. Concorrência e retry ────────────────────────────────────────────────

describe("7–8. duplo clique, simultâneos e retry", () => {
  it("8. retry depois de marcar: responde o projeto sem repetir nenhum efeito", async () => {
    S.db = seed();
    await setUrgency(ACTOR, "p1", true, "x", "2026-10-20");
    const after = state();
    const again = await setUrgency(ACTOR, "p1", true, "outro motivo", "2026-12-31");
    expect(again.urgente).toBe(true);
    expect(state()).toEqual(after);
    expect(mail.sendProjectMovementEmail).toHaveBeenCalledTimes(1);
  });

  it("8. retry depois de remover: nenhum efeito", async () => {
    S.db = seed(URGENT);
    await setUrgency(ACTOR, "p1", false);
    const after = state();
    await setUrgency(ACTOR, "p1", false);
    expect(state()).toEqual(after);
    expect(mail.sendProjectMovementEmail).toHaveBeenCalledTimes(1);
  });

  it("7. pedido simultâneo que já marcou: sucesso idempotente, efeitos uma vez só", async () => {
    S.db = seed();
    S.insideTx = () => {
      S.insideTx = null;
      Object.assign(p1(), URGENT); // o outro pedido comitou antes desta transação
    };
    const out = await setUrgency(ACTOR, "p1", true, "x", "2026-10-20");
    expect(out.urgente).toBe(true);
    expect(S.events).toContain("tx:rollback");
    expect(obsTexts()).toEqual([]);
    expect(S.db.auditLog).toEqual([]);
    expect(mail.sendProjectMovementEmail).not.toHaveBeenCalled();
    expect(p1().urgentReason).toBe("cliente"); // não sobrescreve o que o outro gravou
  });

  it("7. projeto aprovado entre a leitura e a transação: 400 de antes, nada aplicado", async () => {
    S.db = seed();
    S.insideTx = () => {
      S.insideTx = null;
      p1().status = "PROJETO_APROVADO";
    };
    await expectHttp(setUrgency(ACTOR, "p1", true, "x", "2026-10-20"), 400, /Projetos aprovados/);
    expect(p1().priority).toBe("NORMAL");
    expect(obsTexts()).toEqual([]);
    expect(mail.sendProjectMovementEmail).not.toHaveBeenCalled();
  });

  it("mesmo evento no mesmo dia não reenvia e-mail (deduplicação existente preservada)", async () => {
    S.db = seed();
    await setUrgency(ACTOR, "p1", true, "a", "2026-10-20");
    await setUrgency(ACTOR, "p1", false);
    await setUrgency(ACTOR, "p1", true, "b", "2026-10-21");
    const marks = mail.sendProjectMovementEmail.mock.calls.filter((c) => c[0].eventType === "MARKED_URGENT");
    expect(marks).toHaveLength(1);
    expect(obsTexts().filter((t) => t.includes("sem duplicar"))).toHaveLength(1);
  });
});

// ─── 9. Permissões ────────────────────────────────────────────────────────────

describe("9. permissões inalteradas", () => {
  it.each(["SELLER", "COMMERCIAL", "VIEWER", "PROJECTS"] as UserRole[])("%s (sem markUrgent/somente leitura): 403, nada muda, 0 e-mail", async (role) => {
    S.db = seed();
    const before = state();
    await expectHttp(setUrgency(makeUser(role), "p1", true, "x", "2026-10-20"), 403);
    expect(state()).toEqual(before);
    expect(mail.sendProjectMovementEmail).not.toHaveBeenCalled();
  });

  it("remover também exige markUrgent: 403 sem efeitos", async () => {
    S.db = seed(URGENT);
    const before = state();
    await expectHttp(setUrgency(makeUser("MANAGER", (p) => { p.projects.markUrgent = false; }), "p1", false), 403);
    expect(state()).toEqual(before);
  });

  it.each(["ADMIN", "MANAGER"] as UserRole[])("%s continua podendo marcar e remover", async (role) => {
    const actor = makeUser(role);
    S.db = seed();
    await expect(setUrgency(actor, "p1", true, "x", "2026-10-20")).resolves.toMatchObject({ urgente: true });
    await expect(setUrgency(actor, "p1", false)).resolves.toMatchObject({ urgente: false });
  });
});
