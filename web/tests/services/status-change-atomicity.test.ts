// @vitest-environment node
// Backlog P — atomicidade da mudança de status (server-side).
// Banco em memória com $transaction REAL: se a função da transação lança, o
// estado volta ao snapshot (como o rollback do MySQL). Falhas são injetadas por
// operação ("tabela.operação") e a sequência de eventos é registrada para provar
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
const prismaFake = h.prismaFake;

vi.mock("@/lib/db/prisma", () => ({ prisma: h.prismaFake }));

const mail = vi.hoisted(() => ({
  sendProjectMovementEmail: vi.fn(),
  sendProjectCreatedEmail: vi.fn(),
}));
vi.mock("@/lib/mail/mail-service", () => mail);

import { changeStatus, statusChangeSideEffects } from "@/server/services/projectService";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeUser(role: UserRole): SessionUser {
  return {
    id: `u-${role}`,
    username: role.toLowerCase(),
    name: `Usuário ${role}`,
    email: null,
    role,
    active: true,
    mustChangePassword: false,
    permissions: structuredClone(getDefaultPermissions(role)),
    lastLoginAt: null,
    sellerId: role === "SELLER" ? "s1" : null,
  };
}
const ADMIN = makeUser("ADMIN");
const PROJECTS = makeUser("PROJECTS");

function seed(status: string, extra: Row = {}): Tables {
  const entered = new Date("2026-09-01T12:00:00.000Z");
  return {
    project: [
      {
        id: "p1",
        code: "CRE-000-0001",
        status,
        sellerId: "s1",
        priority: "URGENTE",
        urgentDeadline: new Date("2026-10-10T00:00:00.000Z"),
        urgentReason: "cliente",
        reviewStudyCount: 0,
        finalReviewCount: 0,
        projectReceived: true,
        cabinLocationDefined: true,
        alignmentCompleted: true,
        currentStatusEnteredAt: entered,
        createdAt: entered,
        updatedAt: entered,
        ...extra,
      },
      { id: "p2", code: "CRE-000-2026", status: "PROJETO_APROVADO", sellerId: "s1", currentStatusEnteredAt: entered, createdAt: entered, updatedAt: entered },
    ],
    projectStatusHistory: [{ id: "h0", projectId: "p1", fromStatus: null, toStatus: status, enteredAt: entered, exitedAt: null }],
    projectReviewStudyHistory: [],
    projectFinalReviewHistory: [],
    projectObservation: [],
    auditLog: [],
    projectNotification: [],
    seller: [{ id: "s1", name: "VENDEDOR UM", email: "vendedor@tsteck.com.br", active: true }],
  };
}

const p1 = () => S.db.project.find((p) => p.id === "p1")!;
const obsTexts = () => S.db.projectObservation.map((o) => o.text);

/** Estado "de negócio" comparável (sem os logs pós-commit). */
function businessState() {
  return structuredClone({
    project: S.db.project,
    history: S.db.projectStatusHistory,
    reviewStudy: S.db.projectReviewStudyHistory,
    reviewFinal: S.db.projectFinalReviewHistory,
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
    // Registra o status do projeto no MOMENTO do envio (prova de pós-commit).
    S.events.push(`email:${p1().status}`);
    return { success: true, message: "E-mail enviado com sucesso." };
  });
  mail.sendProjectCreatedEmail.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

// ─── Regras de efeitos (pura) ─────────────────────────────────────────────────

describe("statusChangeSideEffects — mesmas regras que o navegador aplicava", () => {
  it("Kanban: observação sempre; e-mail exceto Elaborar e Projeto Aprovado", () => {
    expect(statusChangeSideEffects({ source: "kanban", from: "ELABORAR_ANTE_PROJETO", to: "ANTE_PROJETO_ENVIADO" })).toEqual({
      observation: "Mudanca de status via Kanban: ELABORAR ANTE-PROJETO -> ANTE-PROJETO ENVIADO.",
      notifySeller: true,
    });
    expect(
      statusChangeSideEffects({ source: "kanban", from: "ANTE_PROJETO_ENVIADO", to: "REVISAO_DE_ESTUDO", note: "  ajuste  " }),
    ).toEqual({
      observation: "Mudanca de status via Kanban: ANTE-PROJETO ENVIADO -> REVISAO DE ESTUDO. Observacao: ajuste",
      notifySeller: true,
    });
    expect(statusChangeSideEffects({ source: "kanban", from: "CADASTRO_INICIAL", to: "ELABORAR_ANTE_PROJETO" }).notifySeller).toBe(false);
    expect(statusChangeSideEffects({ source: "kanban", from: "PROJETO_FINAL_ENVIADO", to: "PROJETO_APROVADO" }).notifySeller).toBe(false);
    expect(statusChangeSideEffects({ source: "kanban", from: "ANTE_PROJETO_APROVADO", to: "PROJETO_FINAL_ENVIADO" }).notifySeller).toBe(true);
  });

  it("menu de ações: observação só com texto; sem e-mail em Elaborar, Aprovado e Projeto Final Enviado", () => {
    expect(statusChangeSideEffects({ source: "acao-rapida", from: "ELABORAR_ANTE_PROJETO", to: "ANTE_PROJETO_ENVIADO" })).toEqual({
      observation: null,
      notifySeller: true,
    });
    expect(
      statusChangeSideEffects({ source: "acao-rapida", from: "ANTE_PROJETO_ENVIADO", to: "REVISAO_DE_ESTUDO", note: "motivo" }).observation,
    ).toBe("Mudanca de status via menu de acoes: ANTE-PROJETO ENVIADO -> REVISAO DE ESTUDO. Observacao: motivo");
    expect(statusChangeSideEffects({ source: "acao-rapida", from: "ANTE_PROJETO_APROVADO", to: "PROJETO_FINAL_ENVIADO" }).notifySeller).toBe(false);
    expect(statusChangeSideEffects({ source: "acao-rapida", from: "PROJETO_FINAL_ENVIADO", to: "PROJETO_APROVADO" }).notifySeller).toBe(false);
  });

  it.each(["formulario", "alinhamento-automatico", "sistema", undefined])("origem %s: nenhum efeito extra", (source) => {
    expect(statusChangeSideEffects({ source, from: "ELABORAR_ANTE_PROJETO", to: "ANTE_PROJETO_ENVIADO", note: "x" })).toEqual({
      observation: null,
      notifySeller: false,
    });
  });
});

// ─── 1. Movimento normal ──────────────────────────────────────────────────────

describe("1. movimento normal", () => {
  it("aplica tudo uma vez; e-mail só depois do commit e com o status já gravado", async () => {
    S.db = seed("ELABORAR_ANTE_PROJETO");
    const out = await changeStatus(PROJECTS, "p1", "ANTE-PROJETO ENVIADO", { source: "kanban" });

    expect(out.status_atual).toBe("ANTE-PROJETO ENVIADO");
    expect(p1()).toMatchObject({ status: "ANTE_PROJETO_ENVIADO", priority: "NORMAL", urgentDeadline: null, urgentReason: null });
    // histórico: anterior fechado, novo aberto
    expect(S.db.projectStatusHistory).toHaveLength(2);
    expect(S.db.projectStatusHistory[0].exitedAt).toBeInstanceOf(Date);
    expect(S.db.projectStatusHistory[1]).toMatchObject({ fromStatus: "ELABORAR_ANTE_PROJETO", toStatus: "ANTE_PROJETO_ENVIADO", source: "kanban" });
    expect(obsTexts()).toEqual([
      "Mudanca de status via Kanban: ELABORAR ANTE-PROJETO -> ANTE-PROJETO ENVIADO.",
      "Notificacao por e-mail ao vendedor: E-mail enviado com sucesso.",
    ]);
    expect(S.db.auditLog).toHaveLength(1);
    expect(mail.sendProjectMovementEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendProjectMovementEmail.mock.calls[0][1]).toEqual(["vendedor@tsteck.com.br"]);
    expect(mail.sendProjectMovementEmail.mock.calls[0][0]).toMatchObject({
      eventType: "STATUS_CHANGED",
      oldStatus: "ELABORAR ANTE-PROJETO",
      newStatus: "ANTE-PROJETO ENVIADO",
      projectCode: "CRE-000-0001",
    });
    expect(S.db.projectNotification).toHaveLength(1);
    // Ordem: transação comitada ANTES do e-mail; no envio o status já é o novo.
    expect(S.events.indexOf("tx:commit")).toBeLessThan(S.events.indexOf("email:ANTE_PROJETO_ENVIADO"));
    expect(S.events).not.toContain("tx:rollback");
  });

  it("observação da movimentação é gravada DENTRO da transação", async () => {
    S.db = seed("ELABORAR_ANTE_PROJETO");
    await changeStatus(PROJECTS, "p1", "ANTE-PROJETO ENVIADO", { source: "kanban" });
    const begin = S.events.indexOf("tx:begin");
    const commit = S.events.indexOf("tx:commit");
    const firstObs = S.events.indexOf("projectObservation.create");
    expect(firstObs).toBeGreaterThan(begin);
    expect(firstObs).toBeLessThan(commit);
  });

  it("vendedor inativo ou sem e-mail: não envia, registra 'ignorada' como antes", async () => {
    S.db = seed("ELABORAR_ANTE_PROJETO");
    S.db.seller[0].active = false;
    await changeStatus(PROJECTS, "p1", "ANTE-PROJETO ENVIADO", { source: "kanban" });
    expect(mail.sendProjectMovementEmail).not.toHaveBeenCalled();
    expect(obsTexts()[1]).toBe("Notificacao por e-mail ao vendedor: Notificação ignorada: vendedor sem e-mail cadastrado.");
    expect(S.db.projectNotification[0]).toMatchObject({ success: false });
  });

  it("formulário: nenhuma observação nem e-mail extra (como antes)", async () => {
    S.db = seed("ELABORAR_ANTE_PROJETO");
    await changeStatus(PROJECTS, "p1", "ANTE-PROJETO ENVIADO", { source: "formulario" });
    expect(p1().status).toBe("ANTE_PROJETO_ENVIADO");
    expect(obsTexts()).toEqual([]);
    expect(mail.sendProjectMovementEmail).not.toHaveBeenCalled();
  });

  it("Kanban → Elaborar: observação + SÓ o e-mail próprio de liberação (sem o genérico)", async () => {
    S.db = seed("CADASTRO_INICIAL", { projectReceived: false, cabinLocationDefined: false, alignmentCompleted: false });
    await changeStatus(PROJECTS, "p1", "ELABORAR ANTE-PROJETO", { source: "kanban" });
    expect(obsTexts()).toEqual(["Mudanca de status via Kanban: CADASTRO INICIAL -> ELABORAR ANTE-PROJETO."]);
    expect(mail.sendProjectMovementEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendProjectMovementEmail.mock.calls[0][0].eventType).toBe("PROJECT_RELEASED_TO_ELABORATE_ANTE_PROJECT");
    expect(p1()).toMatchObject({ projectReceived: true, cabinLocationDefined: true, alignmentCompleted: true });
  });
});

// ─── 2–5. Falhas: nada permanece ──────────────────────────────────────────────

describe("falhas — nenhum efeito permanece", () => {
  it("2. falha antes da persistência (código final inválido): nada muda", async () => {
    S.db = seed("ANTE_PROJETO_APROVADO");
    const before = businessState();
    await expectHttp(changeStatus(PROJECTS, "p1", "PROJETO FINAL ENVIADO", { source: "kanban", finalCode: "SEM-DIGITOS" }), 400, /Código final inválido/);
    expect(businessState()).toEqual(before);
    expect(S.events).not.toContain("tx:begin");
    expect(mail.sendProjectMovementEmail).not.toHaveBeenCalled();
  });

  it.each([
    ["3. atualização do projeto", "project.updateMany"],
    ["4. após operação interna (fechar histórico)", "projectStatusHistory.updateMany"],
    ["4. após operação interna (criar histórico)", "projectStatusHistory.create"],
    ["5. gravação da observação", "projectObservation.create"],
  ])("%s falha: status, histórico, observação e e-mail intactos", async (_label, op) => {
    S.db = seed("ELABORAR_ANTE_PROJETO");
    const before = businessState();
    S.failOn = op;
    await expect(changeStatus(PROJECTS, "p1", "ANTE-PROJETO ENVIADO", { source: "kanban", note: "obs" })).rejects.toThrow(/falha simulada/);
    expect(businessState()).toEqual(before);
    expect(p1().status).toBe("ELABORAR_ANTE_PROJETO");
    expect(S.db.projectStatusHistory[0].exitedAt).toBeNull();
    expect(obsTexts()).toEqual([]);
    expect(S.db.auditLog).toEqual([]);
    expect(S.db.projectNotification).toEqual([]);
    expect(mail.sendProjectMovementEmail).not.toHaveBeenCalled();
    expect(S.events).toContain("tx:rollback");
  });
});

// ─── 6. Falha no e-mail (externo, pós-commit) ─────────────────────────────────

describe("6. falha na notificação externa", () => {
  it("e-mail falha: a transição já comitada permanece íntegra e a falha fica registrada", async () => {
    S.db = seed("ELABORAR_ANTE_PROJETO");
    mail.sendProjectMovementEmail.mockResolvedValue({ success: false, message: "Falha SMTP: timeout" });
    const out = await changeStatus(PROJECTS, "p1", "ANTE-PROJETO ENVIADO", { source: "kanban" });
    expect(out.status_atual).toBe("ANTE-PROJETO ENVIADO");
    expect(S.db.projectStatusHistory).toHaveLength(2);
    expect(obsTexts()).toEqual([
      "Mudanca de status via Kanban: ELABORAR ANTE-PROJETO -> ANTE-PROJETO ENVIADO.",
      "Notificacao por e-mail ao vendedor: Falha SMTP: timeout",
    ]);
    expect(S.db.projectNotification[0]).toMatchObject({ success: false, errorMessage: "Falha SMTP: timeout" });
  });

  it("e-mail lança exceção: changeStatus não falha nem desfaz a transição", async () => {
    S.db = seed("ELABORAR_ANTE_PROJETO");
    mail.sendProjectMovementEmail.mockRejectedValue(new Error("SMTP caiu"));
    const out = await changeStatus(PROJECTS, "p1", "ANTE-PROJETO ENVIADO", { source: "kanban" });
    expect(out.status_atual).toBe("ANTE-PROJETO ENVIADO");
    expect(obsTexts()[1]).toBe("Notificacao por e-mail ao vendedor: Falha ao enviar e-mail (registrada, fluxo não afetado).");
  });

  it("falha ao registrar a observação da notificação não desfaz a transição", async () => {
    S.db = seed("ELABORAR_ANTE_PROJETO");
    let n = 0;
    const original = prismaFake.projectObservation.create;
    prismaFake.projectObservation.create = async (args: Row) => {
      if (++n === 2) throw new Error("falha simulada no registro pós-envio");
      return original(args);
    };
    try {
      const out = await changeStatus(PROJECTS, "p1", "ANTE-PROJETO ENVIADO", { source: "kanban" });
      expect(out.status_atual).toBe("ANTE-PROJETO ENVIADO");
      expect(obsTexts()).toEqual(["Mudanca de status via Kanban: ELABORAR ANTE-PROJETO -> ANTE-PROJETO ENVIADO."]);
      expect(mail.sendProjectMovementEmail).toHaveBeenCalledTimes(1);
    } finally {
      prismaFake.projectObservation.create = original;
    }
  });
});

// ─── 7. Revisão com motivo ────────────────────────────────────────────────────

describe("7. revisão com motivo", () => {
  it("sucesso: motivo na revisão, contador +1, observação com o motivo", async () => {
    S.db = seed("ANTE_PROJETO_ENVIADO");
    await changeStatus(PROJECTS, "p1", "REVISAO DE ESTUDO", { source: "kanban", reason: "Cliente pediu ajuste", note: "Cliente pediu ajuste" });
    expect(p1()).toMatchObject({ status: "REVISAO_DE_ESTUDO", reviewStudyCount: 1 });
    expect(S.db.projectReviewStudyHistory).toHaveLength(1);
    expect(S.db.projectReviewStudyHistory[0]).toMatchObject({ reason: "Cliente pediu ajuste" });
    expect(obsTexts()[0]).toBe("Mudanca de status via Kanban: ANTE-PROJETO ENVIADO -> REVISAO DE ESTUDO. Observacao: Cliente pediu ajuste");
  });

  it.each(["projectReviewStudyHistory.create", "projectObservation.create"])(
    "falha em %s: motivo/revisão/contador não ficam salvos isoladamente",
    async (op) => {
      S.db = seed("ANTE_PROJETO_ENVIADO");
      const before = businessState();
      S.failOn = op;
      await expect(
        changeStatus(PROJECTS, "p1", "REVISAO DE ESTUDO", { source: "kanban", reason: "Cliente pediu ajuste", note: "Cliente pediu ajuste" }),
      ).rejects.toThrow(/falha simulada/);
      expect(businessState()).toEqual(before);
      expect(S.db.projectReviewStudyHistory).toEqual([]);
      expect(p1().reviewStudyCount).toBe(0);
      expect(mail.sendProjectMovementEmail).not.toHaveBeenCalled();
    },
  );

  it("saída da revisão fecha a revisão aberta; se falhar, ela continua aberta", async () => {
    S.db = seed("REVISAO_DE_PROJETO_FINAL", { finalReviewCount: 1 });
    S.db.projectFinalReviewHistory.push({ id: "rf1", projectId: "p1", reason: "x", exitedAt: null });
    S.failOn = "projectObservation.create";
    await expect(changeStatus(PROJECTS, "p1", "PROJETO FINAL ENVIADO", { source: "kanban" })).rejects.toThrow();
    expect(S.db.projectFinalReviewHistory[0].exitedAt).toBeNull();
    S.failOn = null;
    await changeStatus(PROJECTS, "p1", "PROJETO FINAL ENVIADO", { source: "kanban" });
    expect(S.db.projectFinalReviewHistory[0].exitedAt).toBeInstanceOf(Date);
  });
});

// ─── 8. Código final ──────────────────────────────────────────────────────────

describe("8. código final", () => {
  it("sucesso: código atualizado junto com o status", async () => {
    S.db = seed("ANTE_PROJETO_APROVADO");
    const out = await changeStatus(PROJECTS, "p1", "PROJETO FINAL ENVIADO", { source: "kanban", finalCode: "CRE-000-9999" });
    expect(out.codigo_projeto).toBe("CRE-000-9999");
    expect(p1()).toMatchObject({ status: "PROJETO_FINAL_ENVIADO", code: "CRE-000-9999" });
  });

  it("falha dentro da transação: nem código nem status mudam", async () => {
    S.db = seed("ANTE_PROJETO_APROVADO");
    S.failOn = "projectStatusHistory.create";
    await expect(changeStatus(PROJECTS, "p1", "PROJETO FINAL ENVIADO", { source: "kanban", finalCode: "CRE-000-9999" })).rejects.toThrow();
    expect(p1()).toMatchObject({ status: "ANTE_PROJETO_APROVADO", code: "CRE-000-0001" });
  });

  it("código duplicado (409) antes da transação: nada muda", async () => {
    S.db = seed("ANTE_PROJETO_APROVADO");
    const before = businessState();
    await expectHttp(changeStatus(PROJECTS, "p1", "PROJETO FINAL ENVIADO", { source: "kanban", finalCode: "CRE-000-2026" }), 409);
    expect(businessState()).toEqual(before);
  });

  it("menu da tabela → Projeto Final Enviado: observação só com texto e sem e-mail (como antes)", async () => {
    S.db = seed("ANTE_PROJETO_APROVADO");
    await changeStatus(PROJECTS, "p1", "PROJETO FINAL ENVIADO", { source: "acao-rapida", finalCode: "CRE-000-9999", note: "enviado ao cliente" });
    expect(obsTexts()).toEqual([
      "Mudanca de status via menu de acoes: ANTE-PROJETO APROVADO -> PROJETO FINAL ENVIADO. Observacao: enviado ao cliente",
    ]);
    expect(mail.sendProjectMovementEmail).not.toHaveBeenCalled();
  });
});

// ─── 9. Bloqueios inalterados ─────────────────────────────────────────────────

describe("9. bloqueios de transição continuam iguais", () => {
  it("transição fora do fluxo: 400 com a mesma mensagem, sem efeitos", async () => {
    S.db = seed("ELABORAR_ANTE_PROJETO");
    const before = businessState();
    await expectHttp(
      changeStatus(PROJECTS, "p1", "PROJETO APROVADO", { source: "kanban" }),
      400,
      /Movimentação de "ELABORAR ANTE-PROJETO" para "PROJETO APROVADO" não é permitida no fluxo\./,
    );
    expect(businessState()).toEqual(before);
  });

  it("revisão sem motivo: 400, sem efeitos", async () => {
    S.db = seed("ANTE_PROJETO_ENVIADO");
    const before = businessState();
    await expectHttp(changeStatus(PROJECTS, "p1", "REVISAO DE ESTUDO", { source: "kanban" }), 400, /Informe o motivo da revisão/);
    expect(businessState()).toEqual(before);
  });

  it.each(["SELLER", "COMMERCIAL", "VIEWER"] as UserRole[])("%s: 403, sem efeitos", async (role) => {
    S.db = seed("ELABORAR_ANTE_PROJETO");
    const before = businessState();
    await expectHttp(changeStatus(makeUser(role), "p1", "ANTE-PROJETO ENVIADO", { source: "kanban" }), 403);
    expect(businessState()).toEqual(before);
  });

  it("ADMIN e PROJECTS continuam podendo mover", async () => {
    for (const actor of [ADMIN, PROJECTS]) {
      S.db = seed("ELABORAR_ANTE_PROJETO");
      await expect(changeStatus(actor, "p1", "ANTE-PROJETO ENVIADO", { source: "kanban" })).resolves.toMatchObject({
        status_atual: "ANTE-PROJETO ENVIADO",
      });
    }
  });
});

// ─── 10. Retry / duplicidade ──────────────────────────────────────────────────

describe("10. retry e duplicidade", () => {
  it("pedido repetido depois do sucesso: responde o projeto sem repetir nenhum efeito", async () => {
    S.db = seed("ELABORAR_ANTE_PROJETO");
    await changeStatus(PROJECTS, "p1", "ANTE-PROJETO ENVIADO", { source: "kanban" });
    const after = businessState();
    const again = await changeStatus(PROJECTS, "p1", "ANTE-PROJETO ENVIADO", { source: "kanban" });
    expect(again.status_atual).toBe("ANTE-PROJETO ENVIADO");
    expect(businessState()).toEqual(after);
    expect(mail.sendProjectMovementEmail).toHaveBeenCalledTimes(1);
  });

  it("pedido simultâneo (outro já aplicou o mesmo destino): sucesso idempotente, efeitos uma vez só", async () => {
    S.db = seed("ELABORAR_ANTE_PROJETO");
    // Entre a leitura e a transação, a 1ª requisição comita o mesmo movimento.
    S.insideTx = () => {
      S.insideTx = null;
      p1().status = "ANTE_PROJETO_ENVIADO";
    };
    const out = await changeStatus(PROJECTS, "p1", "ANTE-PROJETO ENVIADO", { source: "kanban" });
    expect(out.status_atual).toBe("ANTE-PROJETO ENVIADO");
    expect(S.events).toContain("tx:rollback");
    expect(S.db.projectStatusHistory).toHaveLength(1);
    expect(obsTexts()).toEqual([]);
    expect(S.db.auditLog).toEqual([]);
    expect(mail.sendProjectMovementEmail).not.toHaveBeenCalled();
  });

  it("pedido simultâneo com status diferente: 409 e nada é aplicado", async () => {
    S.db = seed("ANTE_PROJETO_ENVIADO");
    S.insideTx = () => {
      S.insideTx = null;
      p1().status = "ANTE_PROJETO_APROVADO";
    };
    await expectHttp(
      changeStatus(PROJECTS, "p1", "REVISAO DE ESTUDO", { source: "kanban", reason: "motivo", note: "motivo" }),
      409,
      /alterado por outra operação/,
    );
    expect(p1().status).toBe("ANTE_PROJETO_APROVADO");
    expect(S.db.projectReviewStudyHistory).toEqual([]);
    expect(p1().reviewStudyCount).toBe(0);
    expect(obsTexts()).toEqual([]);
    expect(mail.sendProjectMovementEmail).not.toHaveBeenCalled();
  });

  it("mesmo e-mail no mesmo dia não é reenviado (deduplicação existente preservada)", async () => {
    S.db = seed("ANTE_PROJETO_ENVIADO");
    await changeStatus(PROJECTS, "p1", "REVISAO DE ESTUDO", { source: "kanban", reason: "r1", note: "r1" });
    await changeStatus(PROJECTS, "p1", "ANTE-PROJETO ENVIADO", { source: "kanban" });
    await changeStatus(PROJECTS, "p1", "REVISAO DE ESTUDO", { source: "kanban", reason: "r2", note: "r2" });
    const toReview = mail.sendProjectMovementEmail.mock.calls.filter((c) => c[0].newStatus === "REVISAO DE ESTUDO");
    expect(toReview).toHaveLength(1);
    expect(obsTexts().filter((t) => t.includes("sem duplicar"))).toHaveLength(1);
  });
});
