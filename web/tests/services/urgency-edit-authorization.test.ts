// @vitest-environment node
// Urgência exige projects.markUrgent em QUALQUER caminho do servidor: /urgency,
// edição (updateProject) e criação (createProject). Antes, a edição pelo drawer
// só exigia projects.edit e servia de atalho para o perfil PROJECTS (que não
// tem markUrgent). Editar os demais campos continua só com projects.edit.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { SessionUser } from "@/server/auth/session";
import type { UserRole } from "@/features/auth/lib/auth-types";
import { HttpError } from "@/server/auth/guards";

/* eslint-disable @typescript-eslint/no-explicit-any */
const db = vi.hoisted(() => {
  const state = { project: null as any, calls: [] as string[] };
  const ref = { findFirst: vi.fn(async () => ({ id: "ref-1" })) };
  const prisma = {
    constructor: ref,
    work: ref,
    seller: { findFirst: vi.fn(async () => ({ id: "s1" })), findUnique: vi.fn(async () => ({ email: "", active: true })) },
    equipment: ref,
    cabinType: ref,
    engineer: ref,
    workUnit: ref,
    project: {
      findUnique: vi.fn(async ({ where }: any) => (where.code ? null : state.project ? { ...state.project } : null)),
      findFirst: vi.fn(async () => null),
      findUniqueOrThrow: vi.fn(async () => ({ ...state.project })),
      update: vi.fn(async ({ data }: any) => {
        state.calls.push("project.update");
        const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
        state.project = { ...state.project, ...clean };
        return { ...state.project };
      }),
      updateMany: vi.fn(async () => ({ count: 1 })),
      create: vi.fn(async ({ data }: any) => {
        state.calls.push("project.create");
        return { id: "novo", createdAt: new Date(), updatedAt: new Date(), currentStatusEnteredAt: new Date(), reviewStudyCount: 0, finalReviewCount: 0, ...data };
      }),
    },
    projectObservation: { create: vi.fn(async () => { state.calls.push("observation"); return {}; }) },
    auditLog: { create: vi.fn(async () => { state.calls.push("audit"); return {}; }) },
    projectNotification: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => { state.calls.push("notification"); }) },
    $transaction: vi.fn(async (fn: any) => fn(prisma)),
  };
  return { state, prisma };
});
vi.mock("@/lib/db/prisma", () => ({ prisma: db.prisma }));
const mail = vi.hoisted(() => ({ sendProjectMovementEmail: vi.fn(), sendProjectCreatedEmail: vi.fn() }));
vi.mock("@/lib/mail/mail-service", () => mail);

import { createProject, setUrgency, updateProject, urgencyChangeRequested } from "@/server/services/projectService";

function makeUser(role: UserRole, patch?: (p: ReturnType<typeof getDefaultPermissions>) => void): SessionUser {
  const permissions = structuredClone(getDefaultPermissions(role));
  patch?.(permissions);
  return { id: `u-${role}`, username: role.toLowerCase(), name: `Usuário ${role}`, email: null, role, active: true, mustChangePassword: false, permissions, lastLoginAt: null, sellerId: null };
}
const PROJECTS = makeUser("PROJECTS");

const DEADLINE = new Date("2026-10-20T00:00:00.000Z");
function existing(urgent: boolean) {
  return {
    id: "p1",
    code: "CRE-000-0001",
    status: "ELABORAR_ANTE_PROJETO",
    sellerId: "s1",
    priority: urgent ? "URGENTE" : "NORMAL",
    urgentDeadline: urgent ? DEADLINE : null,
    urgentReason: urgent ? "cliente pediu" : null,
    projectReceived: true,
    cabinLocationDefined: true,
    alignmentCompleted: true,
    reviewStudyCount: 0,
    finalReviewCount: 0,
    currentStatusEnteredAt: DEADLINE,
    createdAt: DEADLINE,
    updatedAt: DEADLINE,
  };
}
/** O que o formulário envia: o projeto inteiro (cadastros por nome + urgência atual). */
function payload(over: Record<string, unknown> = {}) {
  return { construtora: "ACRY", obra: "OBRA", vendedor: "VENDEDOR", equipamento: "EK-15/26", engenheiro_nome: "Eng", ...over };
}
const updateData = () => db.prisma.project.update.mock.calls.at(-1)![0].data;

async function expect403(p: Promise<unknown>) {
  await expect(p).rejects.toBeInstanceOf(HttpError);
  await p.catch((e: HttpError) => expect(e.status).toBe(403));
}

beforeEach(() => {
  vi.clearAllMocks();
  db.state.calls = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
  mail.sendProjectMovementEmail.mockResolvedValue({ success: true, message: "ok" });
  mail.sendProjectCreatedEmail.mockResolvedValue({ success: true, message: "ok" });
});

describe("urgencyChangeRequested — compara com o banco", () => {
  const normal = { priority: "NORMAL", urgentDeadline: null, urgentReason: null };
  const urgent = { priority: "URGENTE", urgentDeadline: DEADLINE, urgentReason: "cliente pediu" };
  it.each([
    ["sem campo de urgência no pedido", normal, {}, false],
    ["NORMAL reenviado como NORMAL", normal, { urgente: false }, false],
    ["NORMAL → URGENTE", normal, { urgente: true, urgentDeadline: "2026-10-20" }, true],
    ["URGENTE → NORMAL", urgent, { urgente: false }, true],
    ["URGENTE reenviado igual (data ISO)", urgent, { urgente: true, urgentDeadline: "2026-10-20T00:00:00.000Z", urgentReason: "cliente pediu" }, false],
    ["URGENTE reenviado igual (data curta, motivo com espaços)", urgent, { urgente: true, urgentDeadline: "2026-10-20", urgentReason: "  cliente pediu " }, false],
    ["URGENTE com prazo novo", urgent, { urgente: true, urgentDeadline: "2026-11-01", urgentReason: "cliente pediu" }, true],
    ["URGENTE com motivo novo", urgent, { urgente: true, urgentDeadline: "2026-10-20", urgentReason: "outro" }, true],
  ])("%s → %s", (_l, ex, data, expected) => {
    expect(urgencyChangeRequested(ex as any, data as any)).toBe(expected);
  });
});

describe("updateProject — PROJECTS (edit sim, markUrgent não)", () => {
  it("edita campo comum reenviando a urgência igual (NORMAL): permitido, urgência não é gravada", async () => {
    db.state.project = existing(false);
    const out = await updateProject(PROJECTS, "p1", payload({ engenheiro_nome: "Novo Eng", urgente: false, urgentDeadline: null, urgentReason: null }) as any);
    expect(out.engenheiro_nome).toBe("Novo Eng");
    expect(updateData()).not.toHaveProperty("urgentDeadline");
    expect(updateData().priority).toBeUndefined();
  });

  it("edita campo comum em projeto URGENTE reenviando a urgência igual: permitido, urgência intacta", async () => {
    db.state.project = existing(true);
    const out = await updateProject(PROJECTS, "p1", payload({ engenheiro_nome: "Novo Eng", urgente: true, urgentDeadline: "2026-10-20T00:00:00.000Z", urgentReason: "cliente pediu" }) as any);
    expect(out.urgente).toBe(true);
    expect(updateData().priority).toBeUndefined();
    expect(db.state.project).toMatchObject({ priority: "URGENTE", urgentReason: "cliente pediu" });
  });

  it.each([
    ["NORMAL → URGENTE", false, { urgente: true, urgentDeadline: "2026-10-20", urgentReason: "x" }],
    ["URGENTE → NORMAL", true, { urgente: false, urgentDeadline: null, urgentReason: null }],
    ["muda só o prazo", true, { urgente: true, urgentDeadline: "2026-12-31", urgentReason: "cliente pediu" }],
    ["muda só o motivo", true, { urgente: true, urgentDeadline: "2026-10-20", urgentReason: "outro motivo" }],
  ])("%s: 403, nada gravado, sem auditoria/observação/e-mail", async (_l, urgent, data) => {
    db.state.project = existing(urgent as boolean);
    const before = structuredClone(db.state.project);
    await expect403(updateProject(PROJECTS, "p1", payload(data as any) as any));
    expect(db.prisma.project.update).not.toHaveBeenCalled();
    expect(db.state.project).toEqual(before);
    expect(db.state.calls).toEqual([]);
    expect(mail.sendProjectMovementEmail).not.toHaveBeenCalled();
  });
});

describe("updateProject — perfis com markUrgent", () => {
  it.each(["ADMIN", "MANAGER"] as UserRole[])("%s: NORMAL → URGENTE e URGENTE → NORMAL permitidos", async (role) => {
    db.state.project = existing(false);
    await updateProject(makeUser(role), "p1", payload({ urgente: true, urgentDeadline: "2026-10-20", urgentReason: "x" }) as any);
    expect(updateData()).toMatchObject({ priority: "URGENTE", urgentReason: "x" });
    await updateProject(makeUser(role), "p1", payload({ urgente: false }) as any);
    expect(updateData()).toMatchObject({ priority: "NORMAL", urgentDeadline: null, urgentReason: null });
  });

  it("perfil personalizado com edit + markUrgent: permitido", async () => {
    db.state.project = existing(false);
    const custom = makeUser("CUSTOM", (p) => { p.projects.edit = true; p.projects.markUrgent = true; });
    await updateProject(custom, "p1", payload({ urgente: true, urgentDeadline: "2026-10-20" }) as any);
    expect(updateData().priority).toBe("URGENTE");
  });

  it("marcar sem prazo continua 400 (regra existente)", async () => {
    db.state.project = existing(false);
    await expect(updateProject(makeUser("ADMIN"), "p1", payload({ urgente: true }) as any)).rejects.toMatchObject({ status: 400 });
  });
});

describe("createProject — criar já urgente exige markUrgent", () => {
  it("PROJECTS cria projeto normal: permitido", async () => {
    await createProject(PROJECTS, { codigo_projeto: "CRE-000-0099", ...payload({ urgente: false }) } as any);
    expect(db.prisma.project.create).toHaveBeenCalledTimes(1);
  });

  it("PROJECTS cria projeto urgente: 403, nada criado, sem e-mail", async () => {
    await expect403(createProject(PROJECTS, { codigo_projeto: "CRE-000-0099", ...payload({ urgente: true, urgentDeadline: "2026-10-20" }) } as any));
    expect(db.prisma.project.create).not.toHaveBeenCalled();
    expect(mail.sendProjectCreatedEmail).not.toHaveBeenCalled();
  });

  it("ADMIN cria projeto urgente: permitido", async () => {
    await createProject(makeUser("ADMIN"), { codigo_projeto: "CRE-000-0099", ...payload({ urgente: true, urgentDeadline: "2026-10-20" }) } as any);
    expect(db.prisma.project.create.mock.calls[0][0].data.priority).toBe("URGENTE");
  });
});

describe("/urgency (setUrgency) continua igual", () => {
  it("PROJECTS: 403 sem efeitos", async () => {
    db.state.project = existing(false);
    await expect403(setUrgency(PROJECTS, "p1", true, "x", "2026-10-20"));
    expect(db.state.calls).toEqual([]);
  });
});
