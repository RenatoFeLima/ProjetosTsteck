// @vitest-environment node
// Backlog U — Cadastro Inicial → Elaborar: o servidor valida os mesmos
// pré-requisitos que o Kanban/cliente já exigia (validateStatusTransition). Antes,
// uma chamada direta a POST /status passava e marcava os 3 campos como true.
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

import { changeStatus } from "@/server/services/projectService";
import { validateStatusTransition } from "@/features/projects/domain/project-rules";
import type { Project } from "@/features/projects/domain/project-types";

const ADMIN: SessionUser = {
  id: "u-admin", username: "admin", name: "Admin", email: null, role: "ADMIN" as UserRole, active: true,
  mustChangePassword: false, permissions: structuredClone(getDefaultPermissions("ADMIN")), lastLoginAt: null, sellerId: null,
};

function seed(flags: { projectReceived: boolean; cabinLocationDefined: boolean; alignmentCompleted: boolean }, status = "CADASTRO_INICIAL"): Tables {
  const at = new Date("2026-09-01T12:00:00.000Z");
  return {
    project: [{ id: "p1", code: "CRE-000-0001", status, sellerId: "s1", priority: "NORMAL", urgentDeadline: null, urgentReason: null, reviewStudyCount: 0, finalReviewCount: 0, currentStatusEnteredAt: at, createdAt: at, updatedAt: at, ...flags }],
    projectStatusHistory: [{ id: "h0", projectId: "p1", fromStatus: null, toStatus: status, enteredAt: at, exitedAt: null }],
    projectReviewStudyHistory: [],
    projectFinalReviewHistory: [],
    projectObservation: [],
    auditLog: [],
    projectNotification: [],
    seller: [{ id: "s1", name: "VENDEDOR UM", email: "vendedor@tsteck.com.br", active: true }],
  };
}
const ALL = { projectReceived: true, cabinLocationDefined: true, alignmentCompleted: true };
const p1 = () => S.db.project.find((p) => p.id === "p1")!;
const snapshot = () => structuredClone(S.db);

beforeEach(() => {
  S.failOn = null;
  S.insideTx = null;
  S.events = [];
  S.seq = 0;
  mail.sendProjectMovementEmail.mockReset().mockResolvedValue({ success: true, message: "E-mail enviado com sucesso." });
  mail.sendProjectCreatedEmail.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("Backlog U — Cadastro Inicial → Elaborar valida os pré-requisitos no servidor", () => {
  it("com os 3 pré-requisitos: transição aceita (histórico, auditoria, e-mail de liberação)", async () => {
    S.db = seed(ALL);
    const out = await changeStatus(ADMIN, "p1", "ELABORAR ANTE-PROJETO", { source: "kanban" });
    expect(out.status_atual).toBe("ELABORAR ANTE-PROJETO");
    expect(S.db.projectStatusHistory).toHaveLength(2);
    expect(S.db.auditLog).toHaveLength(1);
    expect(mail.sendProjectMovementEmail.mock.calls[0][0].eventType).toBe("PROJECT_RELEASED_TO_ELABORATE_ANTE_PROJECT");
  });

  it.each([
    ["projeto de obra não recebido", { ...ALL, projectReceived: false }, ["Projeto de obra recebido"]],
    ["local da cabine não definido", { ...ALL, cabinLocationDefined: false }, ["Local da cabine definido"]],
    ["alinhamento não concluído", { ...ALL, alignmentCompleted: false }, ["Alinhamento concluído"]],
    ["nenhum pré-requisito", { projectReceived: false, cabinLocationDefined: false, alignmentCompleted: false }, ["Projeto de obra recebido", "Local da cabine definido", "Alinhamento concluído"]],
  ])("%s: 400 com as pendências, nada gravado, 0 e-mail", async (_l, flags, missing) => {
    S.db = seed(flags as typeof ALL);
    const before = snapshot();
    const err = await changeStatus(ADMIN, "p1", "ELABORAR ANTE-PROJETO", { source: "kanban" }).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(400);
    expect((err as HttpError).message).toBe(`Alinhamento não concluído. Pendências: ${(missing as string[]).join(", ")}.`);
    expect(S.db).toEqual(before);
    expect(S.events).not.toContain("tx:begin");
    expect(mail.sendProjectMovementEmail).not.toHaveBeenCalled();
  });

  it("a regra do servidor é a MESMA do cliente (validateStatusTransition)", async () => {
    const client = validateStatusTransition(
      { status_atual: "CADASTRO INICIAL", proj_obra_recebido: false, local_cabine_definido: true, alinhamento: true } as Project,
      "ELABORAR ANTE-PROJETO",
    );
    S.db = seed({ ...ALL, projectReceived: false });
    const err = (await changeStatus(ADMIN, "p1", "ELABORAR ANTE-PROJETO").catch((e) => e)) as HttpError;
    expect(client.allowed).toBe(false);
    expect(err.message).toBe(`${client.reason} Pendências: ${client.missingFields!.join(", ")}.`);
  });

  it.each(["kanban", "acao-rapida", "formulario", undefined])("vale para qualquer origem (%s)", async (source) => {
    S.db = seed({ ...ALL, alignmentCompleted: false });
    await expect(changeStatus(ADMIN, "p1", "ELABORAR ANTE-PROJETO", { source })).rejects.toMatchObject({ status: 400 });
    expect(p1().status).toBe("CADASTRO_INICIAL");
  });

  it("pré-requisito desmarcado entre a leitura e a transação: 409 e nada aplicado", async () => {
    S.db = seed(ALL);
    S.insideTx = () => {
      S.insideTx = null;
      p1().alignmentCompleted = false; // outra edição comitou antes desta transação
    };
    await expect(changeStatus(ADMIN, "p1", "ELABORAR ANTE-PROJETO", { source: "kanban" })).rejects.toMatchObject({ status: 409 });
    expect(p1().status).toBe("CADASTRO_INICIAL");
    expect(S.db.projectStatusHistory).toHaveLength(1);
    expect(mail.sendProjectMovementEmail).not.toHaveBeenCalled();
  });

  it("outras transições não dependem desses pré-requisitos (sem regressão)", async () => {
    S.db = seed({ projectReceived: false, cabinLocationDefined: false, alignmentCompleted: false }, "ELABORAR_ANTE_PROJETO");
    await expect(changeStatus(ADMIN, "p1", "ANTE-PROJETO ENVIADO", { source: "kanban" })).resolves.toMatchObject({ status_atual: "ANTE-PROJETO ENVIADO" });
  });
});
