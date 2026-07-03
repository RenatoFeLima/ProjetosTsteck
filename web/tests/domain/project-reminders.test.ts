import { describe, expect, it } from "vitest";
import {
  activeRemindersForProject,
  canManageReminders,
  dueReminders,
  getReminderDueState,
  isActiveReminder,
  pickMostCriticalReminder,
  reminderBadgeLabel,
  reminderCriticality,
  reminderDaysOverdue,
  reminderDaysUntil,
  validateReminderInput,
  REMINDER_DESCRIPTION_MAX,
  type ProjectReminder,
} from "@/features/projects/domain/project-reminders";
import type { UserRole } from "@/features/auth/lib/auth-types";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";

const TODAY = "2026-07-03";

function makeReminder(overrides: Partial<ProjectReminder> = {}): ProjectReminder {
  return {
    id: "r1",
    projeto_id: "p1",
    descricao: "Validar com o vendedor a quantidade de itens locados nessa obra.",
    prioridade: "NORMAL",
    status: "PENDENTE",
    data_inicial: "2026-07-01",
    proxima_data: "2026-07-03",
    recorrencia_dias: 7,
    criado_por: "Renato",
    criado_em: "2026-07-01T10:00:00.000Z",
    atualizado_em: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("canManageReminders — deriva de role + projects.edit (não role-only)", () => {
  // getDefaultPermissions retorna a MESMA referência da constante do módulo;
  // clonamos para nunca mutar (e vazar) o default entre testes.
  const perms = (role: UserRole) => structuredClone(getDefaultPermissions(role));
  const withEdit = (role: UserRole, edit: boolean) => {
    const p = perms(role);
    p.projects.edit = edit;
    return p;
  };
  const actor = (role: UserRole) => ({ role, permissions: perms(role) });

  it("1/2. ADMIN e PROJECTS gerenciam (equipe de projetos)", () => {
    expect(canManageReminders(actor("ADMIN"))).toBe(true);
    expect(canManageReminders(actor("PROJECTS"))).toBe(true);
  });

  it("3. CUSTOM com projects.edit=true gerencia (projetista personalizado)", () => {
    expect(canManageReminders({ role: "CUSTOM", permissions: withEdit("CUSTOM", true) })).toBe(true);
  });

  it("4. CUSTOM sem projects.edit NÃO gerencia", () => {
    expect(canManageReminders({ role: "CUSTOM", permissions: withEdit("CUSTOM", false) })).toBe(false);
  });

  it("MANAGER com projects.edit gerencia; sem, não", () => {
    expect(canManageReminders({ role: "MANAGER", permissions: withEdit("MANAGER", true) })).toBe(true);
    expect(canManageReminders({ role: "MANAGER", permissions: withEdit("MANAGER", false) })).toBe(false);
  });

  it("5/6. SELLER e COMMERCIAL NUNCA gerenciam — nem com permissionsJson legado permissivo", () => {
    expect(canManageReminders(actor("SELLER"))).toBe(false);
    expect(canManageReminders(actor("COMMERCIAL"))).toBe(false);
    // Blindagem: mesmo se um permissionsJson legado trouxer projects.edit=true.
    expect(canManageReminders({ role: "SELLER", permissions: withEdit("SELLER", true) })).toBe(false);
    expect(canManageReminders({ role: "COMMERCIAL", permissions: withEdit("COMMERCIAL", true) })).toBe(false);
  });

  it("VIEWER e ator vazio/sem permissões não gerenciam", () => {
    expect(canManageReminders(actor("VIEWER"))).toBe(false);
    expect(canManageReminders({ role: "CUSTOM", permissions: null })).toBe(false);
    expect(canManageReminders(undefined)).toBe(false);
    expect(canManageReminders(null)).toBe(false);
  });

  it("compat: aceita role puro (ADMIN/PROJECTS via string)", () => {
    expect(canManageReminders("ADMIN")).toBe(true);
    expect(canManageReminders("PROJECTS")).toBe(true);
    expect(canManageReminders("SELLER")).toBe(false);
  });
});

describe("getReminderDueState — vencido / hoje / futuro", () => {
  it("data anterior a hoje → vencido", () => {
    expect(getReminderDueState(makeReminder({ proxima_data: "2026-07-01" }), TODAY)).toBe("vencido");
  });

  it("data igual a hoje → hoje", () => {
    expect(getReminderDueState(makeReminder({ proxima_data: "2026-07-03" }), TODAY)).toBe("hoje");
  });

  it("data futura → futuro", () => {
    expect(getReminderDueState(makeReminder({ proxima_data: "2026-07-10" }), TODAY)).toBe("futuro");
  });

  it("dias vencidos e dias restantes", () => {
    expect(reminderDaysOverdue(makeReminder({ proxima_data: "2026-06-27" }), TODAY)).toBe(6);
    expect(reminderDaysOverdue(makeReminder({ proxima_data: "2026-07-10" }), TODAY)).toBe(0);
    expect(reminderDaysUntil(makeReminder({ proxima_data: "2026-07-10" }), TODAY)).toBe(7);
    expect(reminderDaysUntil(makeReminder({ proxima_data: "2026-06-27" }), TODAY)).toBe(0);
  });
});

describe("reminderBadgeLabel", () => {
  it("vencido / hoje / em Xd", () => {
    expect(reminderBadgeLabel(makeReminder({ proxima_data: "2026-07-01" }), TODAY)).toBe("Lembrete vencido");
    expect(reminderBadgeLabel(makeReminder({ proxima_data: "2026-07-03" }), TODAY)).toBe("Lembrete hoje");
    expect(reminderBadgeLabel(makeReminder({ proxima_data: "2026-07-08" }), TODAY)).toBe("Lembrete em 5d");
  });
});

describe("reminderCriticality — ordem do negócio (1..6)", () => {
  it("vencido ALTA (1) < vencido NORMAL (2) < hoje ALTA (3) < hoje NORMAL (4) < futuro ALTA (5) < futuro NORMAL (6)", () => {
    const cases: Array<[string, ProjectReminder["prioridade"], number]> = [
      ["2026-07-01", "ALTA", 1],
      ["2026-07-01", "NORMAL", 2],
      ["2026-07-03", "ALTA", 3],
      ["2026-07-03", "NORMAL", 4],
      ["2026-07-10", "ALTA", 5],
      ["2026-07-10", "NORMAL", 6],
    ];
    for (const [date, prioridade, expected] of cases) {
      expect(reminderCriticality(makeReminder({ proxima_data: date, prioridade }), TODAY)).toBe(expected);
    }
  });

  it("prioridade ALTA fica acima de NORMAL no mesmo estado", () => {
    const alta = reminderCriticality(makeReminder({ proxima_data: "2026-07-01", prioridade: "ALTA" }), TODAY);
    const normal = reminderCriticality(makeReminder({ proxima_data: "2026-07-01", prioridade: "NORMAL" }), TODAY);
    expect(alta).toBeLessThan(normal);
  });
});

describe("pickMostCriticalReminder — múltiplos lembretes no mesmo projeto", () => {
  it("escolhe o mais crítico entre vários", () => {
    const reminders = [
      makeReminder({ id: "futuro-alta", proxima_data: "2026-07-10", prioridade: "ALTA" }),
      makeReminder({ id: "vencido-normal", proxima_data: "2026-07-01", prioridade: "NORMAL" }),
      makeReminder({ id: "vencido-alta", proxima_data: "2026-07-02", prioridade: "ALTA" }),
      makeReminder({ id: "hoje-alta", proxima_data: "2026-07-03", prioridade: "ALTA" }),
    ];
    expect(pickMostCriticalReminder(reminders, "p1", TODAY)?.id).toBe("vencido-alta");
  });

  it("ignora resolvidos e removidos; retorna null sem ativos", () => {
    const reminders = [
      makeReminder({ id: "resolvido", status: "RESOLVIDO", proxima_data: "2026-07-01" }),
      makeReminder({ id: "removido", status: "CANCELADO", proxima_data: "2026-07-01" }),
    ];
    expect(pickMostCriticalReminder(reminders, "p1", TODAY)).toBeNull();
  });

  it("só considera lembretes do projeto pedido", () => {
    const reminders = [
      makeReminder({ id: "outro", projeto_id: "p2", proxima_data: "2026-07-01", prioridade: "ALTA" }),
      makeReminder({ id: "meu", projeto_id: "p1", proxima_data: "2026-07-10" }),
    ];
    expect(pickMostCriticalReminder(reminders, "p1", TODAY)?.id).toBe("meu");
  });

  it("não muta a lista original (não altera dados dos lembretes)", () => {
    const reminders = [
      makeReminder({ id: "b", proxima_data: "2026-07-10" }),
      makeReminder({ id: "a", proxima_data: "2026-07-01" }),
    ];
    const idsBefore = reminders.map((r) => r.id);
    activeRemindersForProject(reminders, "p1", TODAY);
    expect(reminders.map((r) => r.id)).toEqual(idsBefore);
  });
});

describe("dueReminders — base do modal de alerta (vencidos + hoje)", () => {
  it("inclui vencidos e do dia; exclui futuros, resolvidos e removidos", () => {
    const reminders = [
      makeReminder({ id: "vencido", proxima_data: "2026-07-01" }),
      makeReminder({ id: "hoje", proxima_data: "2026-07-03" }),
      makeReminder({ id: "futuro", proxima_data: "2026-07-10" }),
      makeReminder({ id: "resolvido", proxima_data: "2026-07-01", status: "RESOLVIDO" }),
      makeReminder({ id: "removido", proxima_data: "2026-07-01", status: "CANCELADO" }),
    ];
    expect(dueReminders(reminders, TODAY).map((r) => r.id)).toEqual(["vencido", "hoje"]);
  });

  it("16. lembrete recorrente pendente CONTINUA aparecendo até ser resolvido", () => {
    // proxima_data ficou 3 ciclos (21d) no passado — segue ativo/vencido, nunca some sozinho.
    const antigo = makeReminder({ id: "antigo", proxima_data: "2026-06-12", recorrencia_dias: 7 });
    expect(isActiveReminder(antigo)).toBe(true);
    expect(dueReminders([antigo], TODAY).map((r) => r.id)).toEqual(["antigo"]);
    // Só resolver encerra o alerta.
    const resolvido = { ...antigo, status: "RESOLVIDO" as const };
    expect(dueReminders([resolvido], TODAY)).toEqual([]);
  });
});

describe("validateReminderInput — validações do modal/backend", () => {
  const valid = {
    descricao: "Confirmar com o cliente se precisará de item especial.",
    prioridade: "ALTA",
    data_inicial: "2026-07-05",
    recorrencia_dias: 3,
  };

  it("aceita entrada válida (recorrência como número ou string)", () => {
    expect(validateReminderInput(valid).ok).toBe(true);
    const asString = validateReminderInput({ ...valid, recorrencia_dias: "3" });
    expect(asString.ok).toBe(true);
    if (asString.ok) expect(asString.value.recorrencia_dias).toBe(3);
  });

  it("descrição vazia é obrigatória", () => {
    const result = validateReminderInput({ ...valid, descricao: "   " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.descricao).toBeTruthy();
  });

  it("descrição no limite (500) passa; acima de 500 é rejeitada", () => {
    expect(REMINDER_DESCRIPTION_MAX).toBe(500);
    expect(validateReminderInput({ ...valid, descricao: "a".repeat(REMINDER_DESCRIPTION_MAX) }).ok).toBe(true);
    const tooLong = validateReminderInput({ ...valid, descricao: "a".repeat(REMINDER_DESCRIPTION_MAX + 1) });
    expect(tooLong.ok).toBe(false);
    if (!tooLong.ok) expect(tooLong.errors.descricao).toMatch(/máximo 500 caracteres/i);
  });

  it("data é obrigatória", () => {
    const result = validateReminderInput({ ...valid, data_inicial: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.data_inicial).toBeTruthy();
  });

  it("recorrência deve ser inteiro positivo", () => {
    for (const bad of [0, -1, 1.5, "", "abc"]) {
      const result = validateReminderInput({ ...valid, recorrencia_dias: bad });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.recorrencia_dias).toBeTruthy();
    }
  });

  it("prioridade obrigatória (NORMAL ou ALTA)", () => {
    const result = validateReminderInput({ ...valid, prioridade: "URGENTE" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.prioridade).toBeTruthy();
  });
});
