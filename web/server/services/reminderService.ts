// Serviço de Lembretes Operacionais por Projeto — MySQL como fonte da verdade.
// RBAC server-side (defesa em profundidade): gerenciar = ADMIN + PROJECTS por
// ROLE; leitura = quem pode ver o projeto (SELLER só os do próprio vendedor).
// TODA ação de escrita gera ProjectReminderLog + AuditLog. Remoção é soft delete
// (status CANCELADO) — lembrete cancelado não alerta nem conta como pendente.

import { prisma } from "@/lib/db/prisma";
import { assertPermission, HttpError } from "@/server/auth/guards";
import type { SessionUser } from "@/server/auth/session";
import { resolveProjectScope } from "@/features/auth/lib/project-scope";
import {
  canManageReminders,
  validateReminderInput,
  type ProjectReminder as UiReminder,
  type ReminderPriority,
} from "@/features/projects/domain/project-reminders";
import { writeAudit } from "./auditService";

// Ações registradas no log do lembrete.
export const REMINDER_ACTIONS = {
  CREATED: "CRIADO",
  EDITED: "EDITADO",
  PRIORITY_CHANGED: "PRIORIDADE_ALTERADA",
  DATE_CHANGED: "DATA_ALTERADA",
  RECURRENCE_CHANGED: "RECORRENCIA_ALTERADA",
  POSTPONED: "ADIADO",
  RESOLVED: "RESOLVIDO",
  CANCELED: "REMOVIDO",
} as const;

/** Gerenciar lembretes: equipe de projetos (ADMIN/PROJECTS ou quem tem
 *  projects.edit), nunca perfis comerciais. Deriva de role + permissões. */
function assertCanManage(actor: SessionUser): void {
  if (!canManageReminders({ role: actor.role, permissions: actor.permissions })) {
    throw new HttpError(403, "Somente a equipe de Projetos pode gerenciar lembretes.");
  }
}

// ─── Serialização (DB -> formato da UI) ──────────────────────────────────────

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeReminder(r: any): UiReminder {
  return {
    id: r.id,
    projeto_id: r.projectId,
    descricao: r.description,
    prioridade: r.priority,
    status: r.status,
    data_inicial: isoDate(r.startDate),
    proxima_data: isoDate(r.nextAlertDate),
    recorrencia_dias: r.recurrenceDays,
    criado_por: r.createdByName,
    criado_em: iso(r.createdAt) ?? "",
    atualizado_em: iso(r.updatedAt) ?? "",
    resolvido_por: r.resolvedByName ?? null,
    resolvido_em: iso(r.resolvedAt),
    cancelado_por: r.canceledByName ?? null,
    cancelado_em: iso(r.canceledAt),
    adiado_por: r.lastPostponedByName ?? null,
    adiado_em: iso(r.lastPostponedAt),
  };
}

/** yyyy-MM-dd -> Date UTC meia-noite (evita drift de fuso na coluna DATETIME). */
function toUtcDate(isoDay: string): Date {
  return new Date(`${isoDay.slice(0, 10)}T00:00:00.000Z`);
}

async function writeReminderLog(entry: {
  reminderId: string;
  projectId: string;
  action: string;
  actor: SessionUser;
  oldValue?: string | null;
  newValue?: string | null;
}): Promise<void> {
  try {
    await prisma.projectReminderLog.create({
      data: {
        reminderId: entry.reminderId,
        projectId: entry.projectId,
        action: entry.action,
        actorUserId: entry.actor.id,
        actorName: entry.actor.name,
        oldValue: entry.oldValue ?? null,
        newValue: entry.newValue ?? null,
      },
    });
  } catch (err) {
    // Log nunca derruba a ação principal (mesma filosofia do writeAudit).
    console.error("[reminder-log] falha ao gravar log:", err);
  }
}

async function loadReminderOr404(id: string) {
  const reminder = await prisma.projectReminder.findUnique({
    where: { id },
    include: { project: { select: { id: true, code: true, sellerId: true } } },
  });
  if (!reminder) throw new HttpError(404, "Lembrete não encontrado.");
  return reminder;
}

// ─── Leitura ──────────────────────────────────────────────────────────────────

/**
 * Lista lembretes visíveis ao usuário (todos os status — a UI separa ativos,
 * resolvidos e removidos). SELLER vê somente lembretes dos projetos do seu
 * vendedor; sem vínculo é bloqueado. Não expõe dados sensíveis (sem ids de
 * usuário — apenas nomes, como nas observações).
 */
export async function listReminders(actor: SessionUser): Promise<UiReminder[]> {
  assertPermission(actor, (p) => p.projects.view);
  const scope = resolveProjectScope(actor);
  if (scope.kind === "blocked") throw new HttpError(403, scope.reason);

  const rows = await prisma.projectReminder.findMany({
    where: scope.kind === "own" ? { project: { sellerId: scope.sellerId } } : {},
    orderBy: [{ nextAlertDate: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(serializeReminder);
}

// ─── Escrita ──────────────────────────────────────────────────────────────────

export type ReminderCreateInput = {
  descricao?: unknown;
  prioridade?: unknown;
  data_inicial?: unknown;
  recorrencia_dias?: unknown;
};

export async function createReminder(
  actor: SessionUser,
  projectId: string,
  input: ReminderCreateInput,
): Promise<UiReminder> {
  assertCanManage(actor);

  const validation = validateReminderInput(input);
  if (!validation.ok) {
    const first = Object.values(validation.errors)[0];
    throw new HttpError(400, first ?? "Dados do lembrete inválidos.", "VALIDATION_ERROR");
  }
  const value = validation.value;

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, code: true } });
  if (!project) throw new HttpError(404, "Projeto não encontrado.");

  const row = await prisma.projectReminder.create({
    data: {
      projectId,
      description: value.descricao,
      priority: value.prioridade,
      startDate: toUtcDate(value.data_inicial),
      nextAlertDate: toUtcDate(value.data_inicial),
      recurrenceDays: value.recorrencia_dias,
      createdById: actor.id,
      createdByName: actor.name,
    },
  });

  await writeReminderLog({
    reminderId: row.id,
    projectId,
    action: REMINDER_ACTIONS.CREATED,
    actor,
    newValue: `${value.descricao} · prioridade ${value.prioridade} · ${value.data_inicial} · a cada ${value.recorrencia_dias}d`,
  });
  await writeAudit({
    action: "PROJECT_REMINDER_CREATED",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: "project-reminder",
    entityId: row.id,
    message: `${actor.name} criou um lembrete no projeto ${project.code}.`,
  });

  return serializeReminder(row);
}

export type ReminderUpdateInput = {
  descricao?: unknown;
  prioridade?: unknown;
  proxima_data?: unknown;
  recorrencia_dias?: unknown;
};

/** Edita descrição/prioridade/data/recorrência de um lembrete ATIVO, logando
 *  cada campo alterado com valor anterior e novo. */
export async function updateReminder(
  actor: SessionUser,
  id: string,
  input: ReminderUpdateInput,
): Promise<UiReminder> {
  assertCanManage(actor);
  const reminder = await loadReminderOr404(id);
  if (reminder.status !== "PENDENTE") {
    throw new HttpError(400, "Somente lembretes pendentes podem ser editados.");
  }

  // Valida usando os valores atuais como base (patch parcial).
  const validation = validateReminderInput({
    descricao: input.descricao ?? reminder.description,
    prioridade: input.prioridade ?? reminder.priority,
    data_inicial: input.proxima_data ?? isoDate(reminder.nextAlertDate),
    recorrencia_dias: input.recorrencia_dias ?? reminder.recurrenceDays,
  });
  if (!validation.ok) {
    const first = Object.values(validation.errors)[0];
    throw new HttpError(400, first ?? "Dados do lembrete inválidos.", "VALIDATION_ERROR");
  }
  const value = validation.value;

  const row = await prisma.projectReminder.update({
    where: { id },
    data: {
      description: value.descricao,
      priority: value.prioridade as ReminderPriority,
      nextAlertDate: toUtcDate(value.data_inicial),
      recurrenceDays: value.recorrencia_dias,
    },
  });

  // Logs por tipo de mudança (valor anterior -> novo), como pede a auditoria.
  const logs: Array<{ action: string; oldValue: string; newValue: string }> = [];
  if (value.descricao !== reminder.description) {
    logs.push({ action: REMINDER_ACTIONS.EDITED, oldValue: reminder.description, newValue: value.descricao });
  }
  if (value.prioridade !== reminder.priority) {
    logs.push({ action: REMINDER_ACTIONS.PRIORITY_CHANGED, oldValue: reminder.priority, newValue: value.prioridade });
  }
  const oldDate = isoDate(reminder.nextAlertDate);
  if (value.data_inicial !== oldDate) {
    logs.push({ action: REMINDER_ACTIONS.DATE_CHANGED, oldValue: oldDate, newValue: value.data_inicial });
  }
  if (value.recorrencia_dias !== reminder.recurrenceDays) {
    logs.push({
      action: REMINDER_ACTIONS.RECURRENCE_CHANGED,
      oldValue: `${reminder.recurrenceDays}d`,
      newValue: `${value.recorrencia_dias}d`,
    });
  }
  for (const log of logs) {
    await writeReminderLog({ reminderId: id, projectId: reminder.projectId, actor, ...log });
  }
  if (logs.length > 0) {
    await writeAudit({
      action: "PROJECT_REMINDER_EDITED",
      actorUserId: actor.id,
      actorName: actor.name,
      entityType: "project-reminder",
      entityId: id,
      message: `${actor.name} editou um lembrete do projeto ${reminder.project.code}.`,
    });
  }

  return serializeReminder(row);
}

/** Adia o lembrete para uma nova data (amanhã / +7d / +15d / data escolhida). */
export async function postponeReminder(actor: SessionUser, id: string, newDate: unknown): Promise<UiReminder> {
  assertCanManage(actor);
  const date = typeof newDate === "string" ? newDate.trim().slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, "Nova data do lembrete é obrigatória.", "VALIDATION_ERROR");
  }

  const reminder = await loadReminderOr404(id);
  if (reminder.status !== "PENDENTE") {
    throw new HttpError(400, "Somente lembretes pendentes podem ser adiados.");
  }

  const oldDate = isoDate(reminder.nextAlertDate);
  const row = await prisma.projectReminder.update({
    where: { id },
    data: {
      nextAlertDate: toUtcDate(date),
      lastPostponedById: actor.id,
      lastPostponedByName: actor.name,
      lastPostponedAt: new Date(),
    },
  });

  await writeReminderLog({
    reminderId: id,
    projectId: reminder.projectId,
    action: REMINDER_ACTIONS.POSTPONED,
    actor,
    oldValue: oldDate,
    newValue: date,
  });
  await writeAudit({
    action: "PROJECT_REMINDER_POSTPONED",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: "project-reminder",
    entityId: id,
    message: `${actor.name} adiou um lembrete do projeto ${reminder.project.code} para ${date}.`,
  });

  return serializeReminder(row);
}

/** Marca o lembrete como resolvido — deixa de alertar e de contar como pendente. */
export async function resolveReminder(actor: SessionUser, id: string): Promise<UiReminder> {
  assertCanManage(actor);
  const reminder = await loadReminderOr404(id);
  if (reminder.status !== "PENDENTE") {
    throw new HttpError(400, "Este lembrete já foi resolvido ou removido.");
  }

  const row = await prisma.projectReminder.update({
    where: { id },
    data: {
      status: "RESOLVIDO",
      resolvedById: actor.id,
      resolvedByName: actor.name,
      resolvedAt: new Date(),
    },
  });

  await writeReminderLog({
    reminderId: id,
    projectId: reminder.projectId,
    action: REMINDER_ACTIONS.RESOLVED,
    actor,
    oldValue: "PENDENTE",
    newValue: "RESOLVIDO",
  });
  await writeAudit({
    action: "PROJECT_REMINDER_RESOLVED",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: "project-reminder",
    entityId: id,
    message: `${actor.name} marcou como resolvido um lembrete do projeto ${reminder.project.code}.`,
  });

  return serializeReminder(row);
}

/**
 * Remove/cancela o lembrete (soft delete: status CANCELADO). Encerra os alertas
 * recorrentes; o registro permanece no banco para histórico/auditoria.
 */
export async function cancelReminder(actor: SessionUser, id: string): Promise<UiReminder> {
  assertCanManage(actor);
  const reminder = await loadReminderOr404(id);
  if (reminder.status !== "PENDENTE") {
    throw new HttpError(400, "Este lembrete já foi resolvido ou removido.");
  }

  const row = await prisma.projectReminder.update({
    where: { id },
    data: {
      status: "CANCELADO",
      canceledById: actor.id,
      canceledByName: actor.name,
      canceledAt: new Date(),
    },
  });

  await writeReminderLog({
    reminderId: id,
    projectId: reminder.projectId,
    action: REMINDER_ACTIONS.CANCELED,
    actor,
    oldValue: reminder.description,
    newValue: "Lembrete removido — alertas recorrentes encerrados.",
  });
  await writeAudit({
    action: "PROJECT_REMINDER_REMOVED",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: "project-reminder",
    entityId: id,
    message: `${actor.name} removeu o lembrete "${reminder.description.slice(0, 120)}" do projeto ${reminder.project.code}.`,
  });

  return serializeReminder(row);
}
