// @vitest-environment node
// Visibilidade de projetos para SELLER com vários vendedores (UserSeller).
// O banco em memória INTERPRETA o `where` do Prisma (igualdade e `in`), então o
// teste prova o conjunto realmente devolvido — e conta as consultas (uma só,
// com IN; nunca uma por vendedor nem filtro em memória).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { SessionUser } from "@/server/auth/session";
import { HttpError } from "@/server/auth/guards";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const h = vi.hoisted(() => {
  const db: Record<string, Row[]> = {};
  const calls: Array<{ op: string; args: Row }> = [];
  function matchValue(actual: unknown, cond: any): boolean {
    if (cond && typeof cond === "object" && !(cond instanceof Date) && "in" in cond) return (cond.in as unknown[]).includes(actual);
    return actual === cond;
  }
  function matches(table: string, row: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([k, v]) => {
      if (k === "project" && table === "projectReminder") {
        const project = db.project.find((p) => p.id === row.projectId);
        return !!project && matches("project", project, v);
      }
      return matchValue(row[k], v);
    });
  }
  function table(name: string) {
    return {
      findMany: vi.fn(async (args: Row = {}) => {
        calls.push({ op: `${name}.findMany`, args });
        return (db[name] ?? []).filter((r) => matches(name, r, args.where)).map((r) => ({ ...r }));
      }),
      findUnique: vi.fn(async (args: Row) => {
        calls.push({ op: `${name}.findUnique`, args });
        const r = (db[name] ?? []).find((x) => matches(name, x, args.where));
        return r ? { ...r } : null;
      }),
    };
  }
  const prisma: Row = Object.fromEntries(
    ["project", "projectStatusHistory", "projectObservation", "projectReviewStudyHistory", "projectFinalReviewHistory", "projectReminder", "auditLog"].map((t) => [t, table(t)]),
  );
  prisma.auditLog.create = vi.fn(async () => ({}));
  return { db, calls, prisma };
});
vi.mock("@/lib/db/prisma", () => ({ prisma: h.prisma }));

import { exportProjectsCsv, getHistory, getProject, listProjects } from "@/server/services/projectService";
import { listReminders } from "@/server/services/reminderService";

const at = new Date("2026-09-01T12:00:00.000Z");
function project(id: string, code: string, sellerId: string | null) {
  return { id, code, sellerId, status: "ELABORAR_ANTE_PROJETO", priority: "NORMAL", reviewStudyCount: 0, finalReviewCount: 0, projectReceived: true, cabinLocationDefined: true, alignmentCompleted: true, currentStatusEnteredAt: at, createdAt: at, updatedAt: at };
}
function reminder(id: string, projectId: string) {
  return { id, projectId, description: "x", priority: "NORMAL", status: "PENDENTE", startDate: at, nextAlertDate: at, createdAt: at, updatedAt: at, createdByName: "Admin", resolvedAt: null, resolvedByName: null };
}
function seller(sellerIds: string[], extra: Partial<SessionUser> = {}): SessionUser {
  return { id: "u-seller", username: "vendedor", name: "Vendedor", email: null, role: "SELLER", active: true, mustChangePassword: false, permissions: getDefaultPermissions("SELLER"), lastLoginAt: null, sellerIds, ...extra };
}

const CODES = (list: { codigo_projeto: string }[]) => list.map((p) => p.codigo_projeto).sort();
async function status(p: Promise<unknown>): Promise<number> {
  return p.then(() => 200, (e) => (e instanceof HttpError ? e.status : 500));
}

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.db.project = [project("pA", "PRJ-A", "A"), project("pB", "PRJ-B", "B"), project("pC", "PRJ-C", "C"), project("pN", "PRJ-SEM", null)];
  h.db.projectReminder = [reminder("rA", "pA"), reminder("rB", "pB"), reminder("rC", "pC")];
  for (const t of ["projectStatusHistory", "projectObservation", "projectReviewStudyHistory", "projectFinalReviewHistory"]) h.db[t] = [];
});

describe("SELLER vinculado a A + B", () => {
  const AB = seller(["A", "B"]);

  it("lista = A ∪ B, numa ÚNICA consulta com IN (sem filtro em memória)", async () => {
    expect(CODES(await listProjects(AB))).toEqual(["PRJ-A", "PRJ-B"]);
    const finds = h.calls.filter((c) => c.op === "project.findMany");
    expect(finds).toHaveLength(1);
    expect(finds[0].args.where).toEqual({ sellerId: { in: ["A", "B"] } });
  });

  it("GET A → 200, GET B → 200, GET C → 404, projeto sem vendedor → 404", async () => {
    expect(await status(getProject(AB, "pA"))).toBe(200);
    expect(await status(getProject(AB, "pB"))).toBe(200);
    expect(await status(getProject(AB, "pC"))).toBe(404);
    expect(await status(getProject(AB, "pN"))).toBe(404);
  });

  it("histórico: A e B liberados, C bloqueado (404)", async () => {
    expect(await status(getHistory(AB, "pA"))).toBe(200);
    expect(await status(getHistory(AB, "pB"))).toBe(200);
    expect(await status(getHistory(AB, "pC"))).toBe(404);
  });

  it("lembretes: só os de A e B, numa única consulta com IN", async () => {
    const out = await listReminders(AB);
    expect(out.map((r) => r.id).sort()).toEqual(["rA", "rB"]);
    const finds = h.calls.filter((c) => c.op === "projectReminder.findMany");
    expect(finds).toHaveLength(1);
    expect(finds[0].args.where).toEqual({ project: { sellerId: { in: ["A", "B"] } } });
  });

  it("exportação continua proibida ao SELLER (403), como antes", async () => {
    expect(await status(exportProjectsCsv(AB))).toBe(403);
  });
});

describe("CONTRAPROVA — o espelho legado sellerId não autoriza nada", () => {
  const legacyA = seller(["B", "C"], { sellerId: "A" });

  it("sellerId legado = A, sellerIds = [B, C]: A → 404; B e C → 200", async () => {
    expect(await status(getProject(legacyA, "pA"))).toBe(404);
    expect(await status(getProject(legacyA, "pB"))).toBe(200);
    expect(await status(getProject(legacyA, "pC"))).toBe(200);
    expect(await status(getHistory(legacyA, "pA"))).toBe(404);
  });

  it("lista e lembretes também ignoram o legado", async () => {
    expect(CODES(await listProjects(legacyA))).toEqual(["PRJ-B", "PRJ-C"]);
    expect((await listReminders(legacyA)).map((r) => r.id).sort()).toEqual(["rB", "rC"]);
  });

  it("legado presente e nenhum vínculo: bloqueado em tudo (403)", async () => {
    const only = seller([], { sellerId: "A" });
    expect(await status(listProjects(only))).toBe(403);
    expect(await status(getProject(only, "pA"))).toBe(403);
    expect(await status(getHistory(only, "pA"))).toBe(403);
    expect(await status(listReminders(only))).toBe(403);
  });
});

describe("REGRESSÃO — usuário antigo com um único vendedor vê exatamente o mesmo conjunto", () => {
  it.each(["A", "B", "C"])("vendedor %s: IN [%s] ≡ igualdade antiga (sellerId = %s)", async (sid) => {
    const antigo = h.db.project.filter((p) => p.sellerId === sid).map((p) => p.code).sort();
    expect(CODES(await listProjects(seller([sid])))).toEqual(antigo);
    for (const p of h.db.project) {
      expect(await status(getProject(seller([sid]), p.id))).toBe(p.sellerId === sid ? 200 : 404);
    }
  });
});

describe("desempenho — conjuntos grandes continuam numa consulta", () => {
  it.each([1, 5, 20, 100])("%i vendedores → 1 findMany com IN de mesmo tamanho", async (n) => {
    const ids = Array.from({ length: n }, (_, i) => (i === 0 ? "A" : `X${i}`));
    await listProjects(seller(ids));
    const finds = h.calls.filter((c) => c.op === "project.findMany");
    expect(finds).toHaveLength(1);
    expect(finds[0].args.where.sellerId.in).toHaveLength(n);
  });
});
