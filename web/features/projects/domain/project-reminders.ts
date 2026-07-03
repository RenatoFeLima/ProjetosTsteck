// Lembretes operacionais por projeto — domínio PURO (sem Prisma/React).
// Follow-ups vinculados a um projeto (validar com vendedor, contato com cliente,
// reunião técnica...). Regras centrais:
//  - Lembrete NÃO altera status, urgência, SLA/atraso nem ordenação do projeto.
//  - Gerenciam (criar/editar/adiar/resolver/remover): quem trabalha nos projetos
//    (ver canManageReminders). Demais perfis são somente leitura.
//  - Estado do lembrete deriva de proxima_data vs hoje: vencido | hoje | futuro.
//  - Recorrência: o lembrete permanece ativo (e alertando) a cada X dias até ser
//    resolvido/cancelado; adiar avança proxima_data.

import { differenceInCalendarDays, parseISO } from "date-fns";
import type { UserRole, UserPermissions } from "@/features/auth/lib/auth-types";
import { isReadOnlyRole } from "@/features/auth/lib/project-scope";
import { todayIsoDate } from "./project-rules";

export type ReminderPriority = "NORMAL" | "ALTA";
export type ReminderStatus = "PENDENTE" | "RESOLVIDO" | "CANCELADO";

export type ProjectReminder = {
  id: string;
  projeto_id: string;
  descricao: string;
  prioridade: ReminderPriority;
  status: ReminderStatus;
  /** Data inicial escolhida na criação (ISO yyyy-MM-dd). */
  data_inicial: string;
  /** Próxima data de alerta (ISO yyyy-MM-dd) — avança em adiamentos. */
  proxima_data: string;
  /** Recorrência em dias (>= 1). */
  recorrencia_dias: number;
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
  resolvido_por?: string | null;
  resolvido_em?: string | null;
  cancelado_por?: string | null;
  cancelado_em?: string | null;
  adiado_por?: string | null;
  adiado_em?: string | null;
};

export type ReminderLogEntry = {
  id: string;
  lembrete_id: string;
  projeto_id: string;
  acao: string;
  usuario: string;
  valor_anterior?: string | null;
  valor_novo?: string | null;
  criado_em: string;
};

export type ReminderDueState = "vencido" | "hoje" | "futuro";

// ─── Permissões ────────────────────────────────────────────────────────────────

/** Usuário mínimo para decidir se pode gerenciar lembretes (role + permissões). */
export type ReminderActor = {
  role: UserRole | undefined | null;
  permissions?: Pick<UserPermissions, "projects"> | null;
};

/**
 * Quem pode criar/editar/adiar/resolver/cancelar/remover lembretes.
 *
 * Deriva da capability de TRABALHAR nos projetos, não de um role fixo — assim
 * projetistas cadastrados como CUSTOM (com projects.edit) também gerenciam, sem
 * precisar de nova permissão nem migration:
 *   - ADMIN e PROJECTS (equipe de projetos) sempre podem;
 *   - qualquer NÃO-comercial com permissions.projects.edit = true pode.
 *
 * Bloqueia SEMPRE (defesa em profundidade, mesmo com permissionsJson legado
 * permissivo): SELLER e COMMERCIAL (read-only por ROLE, via isReadOnlyRole).
 * Também bloqueia VIEWER, MANAGER/CUSTOM sem projects.edit. A verificação vale
 * no backend, não só na UI.
 */
export function canManageReminders(actor: ReminderActor | UserRole | undefined | null): boolean {
  // Compat: aceita tanto o objeto {role, permissions} quanto um role puro.
  const resolved: ReminderActor =
    typeof actor === "string" ? { role: actor, permissions: undefined } : (actor ?? { role: null });

  const role = resolved.role ?? null;
  // Perfis comerciais são estritamente read-only, independentemente do que o
  // permissionsJson traga (usuários legados). Checado ANTES de qualquer allow.
  if (role && isReadOnlyRole(role)) return false;
  // Equipe de projetos: ADMIN e PROJECTS sempre gerenciam.
  if (role === "ADMIN" || role === "PROJECTS") return true;
  // Demais (MANAGER, CUSTOM, VIEWER): só com permissão de editar projetos.
  return Boolean(resolved.permissions?.projects.edit);
}

// ─── Estado / criticidade ─────────────────────────────────────────────────────

/** Normaliza qualquer ISO (com ou sem hora) para yyyy-MM-dd. */
function dateKey(value: string): string {
  return value.slice(0, 10);
}

/** Lembrete ativo = ainda pendente (aparece no card/alerta/modal). */
export function isActiveReminder(reminder: ProjectReminder): boolean {
  return reminder.status === "PENDENTE";
}

/** Estado do lembrete em relação a hoje: vencido | hoje | futuro. */
export function getReminderDueState(
  reminder: Pick<ProjectReminder, "proxima_data">,
  todayISO: string = todayIsoDate(),
): ReminderDueState {
  const due = dateKey(reminder.proxima_data);
  const today = dateKey(todayISO);
  if (due < today) return "vencido";
  if (due === today) return "hoje";
  return "futuro";
}

/** Dias de atraso (0 se não vencido). */
export function reminderDaysOverdue(
  reminder: Pick<ProjectReminder, "proxima_data">,
  todayISO: string = todayIsoDate(),
): number {
  const diff = differenceInCalendarDays(parseISO(dateKey(todayISO)), parseISO(dateKey(reminder.proxima_data)));
  return Math.max(diff, 0);
}

/** Dias até o alerta (0 se hoje ou vencido). */
export function reminderDaysUntil(
  reminder: Pick<ProjectReminder, "proxima_data">,
  todayISO: string = todayIsoDate(),
): number {
  const diff = differenceInCalendarDays(parseISO(dateKey(reminder.proxima_data)), parseISO(dateKey(todayISO)));
  return Math.max(diff, 0);
}

/**
 * Criticidade do lembrete ativo (menor = mais crítico), na ordem do negócio:
 *  1. vencido + ALTA   2. vencido + NORMAL
 *  3. hoje    + ALTA   4. hoje    + NORMAL
 *  5. futuro  + ALTA   6. futuro  + NORMAL
 */
export function reminderCriticality(
  reminder: Pick<ProjectReminder, "proxima_data" | "prioridade">,
  todayISO: string = todayIsoDate(),
): number {
  const state = getReminderDueState(reminder, todayISO);
  const base = state === "vencido" ? 1 : state === "hoje" ? 3 : 5;
  return reminder.prioridade === "ALTA" ? base : base + 1;
}

/** Lembretes ATIVOS de um projeto, do mais crítico para o menos crítico. */
export function activeRemindersForProject(
  reminders: ProjectReminder[],
  projectId: string,
  todayISO: string = todayIsoDate(),
): ProjectReminder[] {
  return reminders
    .filter((r) => r.projeto_id === projectId && isActiveReminder(r))
    .sort((a, b) => {
      const ca = reminderCriticality(a, todayISO);
      const cb = reminderCriticality(b, todayISO);
      if (ca !== cb) return ca - cb;
      // Empate: data mais próxima/vencida primeiro; depois criação mais antiga.
      const dueCmp = dateKey(a.proxima_data).localeCompare(dateKey(b.proxima_data));
      if (dueCmp !== 0) return dueCmp;
      return a.criado_em.localeCompare(b.criado_em);
    });
}

/** O lembrete mais crítico do projeto (null se não houver ativo). */
export function pickMostCriticalReminder(
  reminders: ProjectReminder[],
  projectId: string,
  todayISO: string = todayIsoDate(),
): ProjectReminder | null {
  return activeRemindersForProject(reminders, projectId, todayISO)[0] ?? null;
}

/** Rótulo curto do estado para o badge do card. */
export function reminderBadgeLabel(
  reminder: Pick<ProjectReminder, "proxima_data">,
  todayISO: string = todayIsoDate(),
): string {
  const state = getReminderDueState(reminder, todayISO);
  if (state === "vencido") return "Lembrete vencido";
  if (state === "hoje") return "Lembrete hoje";
  const days = reminderDaysUntil(reminder, todayISO);
  return `Lembrete em ${days}d`;
}

/** Lembretes ativos vencidos ou do dia (base do modal de alerta estilo Outlook). */
export function dueReminders(
  reminders: ProjectReminder[],
  todayISO: string = todayIsoDate(),
): ProjectReminder[] {
  return reminders
    .filter((r) => isActiveReminder(r) && getReminderDueState(r, todayISO) !== "futuro")
    .sort((a, b) => reminderCriticality(a, todayISO) - reminderCriticality(b, todayISO));
}

// ─── Validação (compartilhada modal ⇄ backend) ────────────────────────────────

export type ReminderInput = {
  descricao?: unknown;
  prioridade?: unknown;
  data_inicial?: unknown;
  recorrencia_dias?: unknown;
};

export type ReminderValidation =
  | { ok: true; value: { descricao: string; prioridade: ReminderPriority; data_inicial: string; recorrencia_dias: number } }
  | { ok: false; errors: Record<string, string> };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

/** Limite de caracteres da descrição do lembrete (validado na UI e no backend). */
export const REMINDER_DESCRIPTION_MAX = 500;

/** Valida os campos do lembrete (criação/edição). Pura — usada na UI e no backend. */
export function validateReminderInput(input: ReminderInput): ReminderValidation {
  const errors: Record<string, string> = {};

  const descricao = typeof input.descricao === "string" ? input.descricao.trim() : "";
  if (!descricao) {
    errors.descricao = "Descrição do lembrete é obrigatória.";
  } else if (descricao.length > REMINDER_DESCRIPTION_MAX) {
    errors.descricao = `A descrição deve ter no máximo ${REMINDER_DESCRIPTION_MAX} caracteres.`;
  }

  const prioridade = input.prioridade;
  if (prioridade !== "NORMAL" && prioridade !== "ALTA") {
    errors.prioridade = "Prioridade é obrigatória (Normal ou Alta).";
  }

  const data = typeof input.data_inicial === "string" ? input.data_inicial.trim() : "";
  if (!data || !ISO_DATE_RE.test(data)) errors.data_inicial = "Data do lembrete é obrigatória.";

  const rawRec = input.recorrencia_dias;
  const rec = typeof rawRec === "number" ? rawRec : typeof rawRec === "string" && rawRec.trim() !== "" ? Number(rawRec) : NaN;
  if (!Number.isInteger(rec) || rec < 1) {
    errors.recorrencia_dias = "Recorrência deve ser um número de dias positivo.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      descricao,
      prioridade: prioridade as ReminderPriority,
      data_inicial: dateKey(data),
      recorrencia_dias: rec,
    },
  };
}
