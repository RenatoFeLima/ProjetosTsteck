// @vitest-environment node
// Lembretes: RBAC + logs são server-side. Prisma é mockado (sem banco real);
// os guards de permissão rodam ANTES de qualquer query.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { SessionUser } from "@/server/auth/session";
import type { UserRole } from "@/features/auth/lib/auth-types";
import { HttpError } from "@/server/auth/guards";

const prismaMock = vi.hoisted(() => ({
  project: { findUnique: vi.fn() },
  projectReminder: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  projectReminderLog: { create: vi.fn() },
  auditLog: { create: vi.fn() },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: prismaMock }));

import {
  cancelReminder,
  createReminder,
  listReminders,
  postponeReminder,
  resolveReminder,
  updateReminder,
} from "@/server/services/reminderService";

function makeUser(role: UserRole, permPatch?: (p: ReturnType<typeof getDefaultPermissions>) => void): SessionUser {
  // Clona: getDefaultPermissions retorna a MESMA referência da constante do
  // módulo; mutar o retorno vazaria o default para outros testes.
  const permissions = structuredClone(getDefaultPermissions(role));
  permPatch?.(permissions);
  return {
    id: `id-${role}`,
    username: role.toLowerCase(),
    name: role,
    email: null,
    role,
    active: true,
    mustChangePassword: false,
    permissions,
    lastLoginAt: null,
    sellerId: role === "SELLER" ? "seller-1" : null,
  };
}

/** Projetista cadastrado como CUSTOM com permissão de editar projetos. */
function customProjectista(): SessionUser {
  return makeUser("CUSTOM", (p) => {
    p.projects.edit = true;
  });
}

function dbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    projectId: "p1",
    description: "Validar com o vendedor a quantidade de itens locados nessa obra.",
    priority: "NORMAL",
    status: "PENDENTE",
    startDate: new Date("2026-07-01T00:00:00.000Z"),
    nextAlertDate: new Date("2026-07-03T00:00:00.000Z"),
    recurrenceDays: 7,
    createdById: "u1",
    createdByName: "Admin",
    createdAt: new Date("2026-07-01T10:00:00.000Z"),
    updatedAt: new Date("2026-07-01T10:00:00.000Z"),
    resolvedById: null,
    resolvedByName: null,
    resolvedAt: null,
    canceledById: null,
    canceledByName: null,
    canceledAt: null,
    lastPostponedById: null,
    lastPostponedByName: null,
    lastPostponedAt: null,
    project: { id: "p1", code: "CRE-UBA-2060", sellerId: null },
    ...overrides,
  };
}

const VALID_INPUT = {
  descricao: "Confirmar com o cliente se precisará de item especial.",
  prioridade: "ALTA",
  data_inicial: "2026-07-05",
  recorrencia_dias: 3,
};

async function expectHttp(status: number, fn: () => Promise<unknown>) {
  try {
    await fn();
    throw new Error(`esperava HttpError ${status}, mas não lançou`);
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError);
    expect((e as HttpError).status).toBe(status);
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.projectReminderLog.create.mockResolvedValue({});
  prismaMock.auditLog.create.mockResolvedValue({});
});

describe("Lembretes — escrita bloqueada (backend retorna 403, não só esconde botão)", () => {
  // CUSTOM aqui é o SEM projects.edit (default viewer-like) → bloqueado.
  const blocked: UserRole[] = ["SELLER", "COMMERCIAL", "VIEWER", "CUSTOM"];

  for (const role of blocked) {
    it(`4/5/6/8. ${role} recebe 403 ao criar lembrete (e nada é gravado)`, async () => {
      await expectHttp(403, () => createReminder(makeUser(role), "p1", VALID_INPUT));
      expect(prismaMock.projectReminder.create).not.toHaveBeenCalled();
    });

    it(`8. ${role} recebe 403 ao editar/adiar/resolver/remover`, async () => {
      await expectHttp(403, () => updateReminder(makeUser(role), "r1", { descricao: "x" }));
      await expectHttp(403, () => postponeReminder(makeUser(role), "r1", "2026-07-10"));
      await expectHttp(403, () => resolveReminder(makeUser(role), "r1"));
      await expectHttp(403, () => cancelReminder(makeUser(role), "r1"));
      expect(prismaMock.projectReminder.update).not.toHaveBeenCalled();
    });
  }

  it("5/6. SELLER e COMMERCIAL são bloqueados MESMO com permissionsJson legado (projects.edit=true)", async () => {
    const legacySeller = makeUser("SELLER", (p) => {
      p.projects.edit = true;
    });
    const legacyCommercial = makeUser("COMMERCIAL", (p) => {
      p.projects.edit = true;
    });
    await expectHttp(403, () => createReminder(legacySeller, "p1", VALID_INPUT));
    await expectHttp(403, () => createReminder(legacyCommercial, "p1", VALID_INPUT));
    expect(prismaMock.projectReminder.create).not.toHaveBeenCalled();
  });
});

describe("Lembretes — criação por equipe de projetos (ADMIN / PROJECTS / CUSTOM+edit)", () => {
  const managers: Array<[string, () => SessionUser]> = [
    ["ADMIN", () => makeUser("ADMIN")],
    ["PROJECTS", () => makeUser("PROJECTS")],
    ["CUSTOM+edit", customProjectista],
  ];

  for (const [label, make] of managers) {
    it(`1/2/3. ${label} cria lembrete com log CRIADO + auditoria`, async () => {
      prismaMock.project.findUnique.mockResolvedValue({ id: "p1", code: "CRE-UBA-2060" });
      prismaMock.projectReminder.create.mockResolvedValue(dbRow({ priority: "ALTA" }));

      const user = make();
      const reminder = await createReminder(user, "p1", VALID_INPUT);

      expect(reminder.projeto_id).toBe("p1");
      expect(reminder.prioridade).toBe("ALTA");
      expect(reminder.status).toBe("PENDENTE");
      // Log da criação com o usuário que criou.
      expect(prismaMock.projectReminderLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "CRIADO", actorName: user.name, reminderId: "r1" }),
        }),
      );
      expect(prismaMock.auditLog.create).toHaveBeenCalled();
    });
  }

  it("3. projetista CUSTOM+edit também edita/adia/resolve/remove", async () => {
    const user = customProjectista();
    prismaMock.projectReminder.findUnique.mockResolvedValue(dbRow());
    prismaMock.projectReminder.update.mockResolvedValue(dbRow({ description: "novo texto" }));
    await expect(updateReminder(user, "r1", { descricao: "novo texto" })).resolves.toBeTruthy();

    prismaMock.projectReminder.findUnique.mockResolvedValue(dbRow());
    prismaMock.projectReminder.update.mockResolvedValue(dbRow({ nextAlertDate: new Date("2026-07-10T00:00:00.000Z") }));
    await expect(postponeReminder(user, "r1", "2026-07-10")).resolves.toBeTruthy();

    prismaMock.projectReminder.findUnique.mockResolvedValue(dbRow());
    prismaMock.projectReminder.update.mockResolvedValue(dbRow({ status: "RESOLVIDO" }));
    await expect(resolveReminder(user, "r1")).resolves.toBeTruthy();

    prismaMock.projectReminder.findUnique.mockResolvedValue(dbRow());
    prismaMock.projectReminder.update.mockResolvedValue(dbRow({ status: "CANCELADO" }));
    await expect(cancelReminder(user, "r1")).resolves.toBeTruthy();
  });

  it("validação: recorrência não-positiva retorna 400 sem gravar", async () => {
    await expectHttp(400, () =>
      createReminder(makeUser("ADMIN"), "p1", { ...VALID_INPUT, recorrencia_dias: 0 }),
    );
    expect(prismaMock.projectReminder.create).not.toHaveBeenCalled();
  });

  it("projeto inexistente retorna 404", async () => {
    prismaMock.project.findUnique.mockResolvedValue(null);
    await expectHttp(404, () => createReminder(makeUser("ADMIN"), "nope", VALID_INPUT));
  });
});

describe("Lembretes — adiamento com log de quem adiou", () => {
  it("adia para nova data e registra ADIADO com valor anterior/novo e usuário", async () => {
    prismaMock.projectReminder.findUnique.mockResolvedValue(dbRow());
    prismaMock.projectReminder.update.mockResolvedValue(
      dbRow({ nextAlertDate: new Date("2026-07-10T00:00:00.000Z"), lastPostponedByName: "PROJECTS" }),
    );

    const reminder = await postponeReminder(makeUser("PROJECTS"), "r1", "2026-07-10");

    expect(reminder.proxima_data).toBe("2026-07-10");
    expect(prismaMock.projectReminderLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ADIADO",
          actorName: "PROJECTS",
          oldValue: "2026-07-03",
          newValue: "2026-07-10",
        }),
      }),
    );
  });

  it("data inválida retorna 400", async () => {
    await expectHttp(400, () => postponeReminder(makeUser("ADMIN"), "r1", "10/07/2026"));
  });
});

describe("Lembretes — conclusão e remoção com log", () => {
  it("resolve registra RESOLVIDO e muda o status", async () => {
    prismaMock.projectReminder.findUnique.mockResolvedValue(dbRow());
    prismaMock.projectReminder.update.mockResolvedValue(dbRow({ status: "RESOLVIDO", resolvedByName: "ADMIN" }));

    const reminder = await resolveReminder(makeUser("ADMIN"), "r1");

    expect(reminder.status).toBe("RESOLVIDO");
    expect(prismaMock.projectReminder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "RESOLVIDO" }) }),
    );
    expect(prismaMock.projectReminderLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "RESOLVIDO", actorName: "ADMIN" }) }),
    );
  });

  it("remover é soft delete (CANCELADO) com log REMOVIDO e descrição no audit", async () => {
    prismaMock.projectReminder.findUnique.mockResolvedValue(dbRow());
    prismaMock.projectReminder.update.mockResolvedValue(dbRow({ status: "CANCELADO", canceledByName: "ADMIN" }));

    const reminder = await cancelReminder(makeUser("ADMIN"), "r1");

    expect(reminder.status).toBe("CANCELADO");
    expect(prismaMock.projectReminder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CANCELADO" }) }),
    );
    expect(prismaMock.projectReminderLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "REMOVIDO" }) }),
    );
  });

  it("lembrete já resolvido/removido não pode ser resolvido de novo (400)", async () => {
    prismaMock.projectReminder.findUnique.mockResolvedValue(dbRow({ status: "RESOLVIDO" }));
    await expectHttp(400, () => resolveReminder(makeUser("ADMIN"), "r1"));
    await expectHttp(400, () => cancelReminder(makeUser("ADMIN"), "r1"));
  });
});

describe("Lembretes — visualização por quem vê o projeto", () => {
  it("SELLER lista somente lembretes dos projetos do próprio vendedor", async () => {
    prismaMock.projectReminder.findMany.mockResolvedValue([dbRow()]);
    const result = await listReminders(makeUser("SELLER"));
    expect(result).toHaveLength(1);
    expect(prismaMock.projectReminder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { project: { sellerId: "seller-1" } } }),
    );
  });

  it("COMMERCIAL (com projects.view) lista todos — leitura permitida", async () => {
    prismaMock.projectReminder.findMany.mockResolvedValue([dbRow()]);
    const result = await listReminders(makeUser("COMMERCIAL"));
    expect(result).toHaveLength(1);
    expect(prismaMock.projectReminder.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it("serialização não expõe ids de usuário (apenas nomes)", async () => {
    prismaMock.projectReminder.findMany.mockResolvedValue([dbRow()]);
    const [reminder] = await listReminders(makeUser("ADMIN"));
    expect(JSON.stringify(reminder)).not.toContain("createdById");
    expect(reminder.criado_por).toBe("Admin");
  });
});
