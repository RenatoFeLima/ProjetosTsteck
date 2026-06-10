// Registro e deduplicação de notificações (server-only). Grava em
// ProjectNotification: envio, falha ou ignorado. A chave única (notificationKey)
// evita e-mails duplicados para o mesmo evento no mesmo dia. Tudo best-effort:
// uma falha de log NUNCA quebra o fluxo nem o envio.

import { prisma } from "@/lib/db/prisma";
import { UI_TO_DB_STATUS } from "@/features/projects/domain/project-status-map";
import type {
  ProjectNotificationEventType,
  ProjectNotificationPayload,
} from "@/features/projects/services/project-notification-service";

// eventType (UI) → NotificationType (enum do banco).
type NotifType =
  | "PROJECT_CREATED"
  | "STATUS_CHANGED"
  | "PROJECT_RELEASED_TO_ELABORATE_ANTE_PROJECT"
  | "URGENCY_MARKED"
  | "URGENCY_REMOVED"
  | "DEADLINE_7_DAYS_LEFT"
  | "DEADLINE_DUE_TODAY"
  | "DEADLINE_OVERDUE";

const TYPE_MAP: Record<ProjectNotificationEventType, NotifType> = {
  PROJECT_CREATED: "PROJECT_CREATED",
  STATUS_CHANGED: "STATUS_CHANGED",
  PROJECT_FINISHED: "STATUS_CHANGED",
  PROJECT_UPDATED: "STATUS_CHANGED",
  PROJECT_RELEASED_TO_ELABORATE_ANTE_PROJECT: "PROJECT_RELEASED_TO_ELABORATE_ANTE_PROJECT",
  MARKED_URGENT: "URGENCY_MARKED",
  URGENCY_REMOVED: "URGENCY_REMOVED",
  DEADLINE_7_DAYS_LEFT: "DEADLINE_7_DAYS_LEFT",
  DEADLINE_DUE_TODAY: "DEADLINE_DUE_TODAY",
  DEADLINE_OVERDUE: "DEADLINE_OVERDUE",
};

function dayPart(payload: ProjectNotificationPayload): string {
  return (payload.dueDate ?? payload.changedAt ?? "").slice(0, 10);
}

/** Chave de deduplicação: projeto + tipo + status + dia. */
export function notificationKeyFor(payload: ProjectNotificationPayload): string {
  const type = TYPE_MAP[payload.eventType] ?? "STATUS_CHANGED";
  return [payload.projectId, type, payload.newStatus ?? "", dayPart(payload)].join("|");
}

/** true se já houve envio com SUCESSO para esta chave (evita duplicar e-mail). */
export async function notificationAlreadySent(key: string): Promise<boolean> {
  try {
    const row = await prisma.projectNotification.findUnique({
      where: { notificationKey: key },
      select: { success: true },
    });
    return row?.success === true;
  } catch {
    return false; // erro de leitura não deve impedir o envio
  }
}

type RecordArgs = {
  payload: ProjectNotificationPayload;
  key: string;
  sentTo: string[];
  success: boolean;
  error?: string;
  /** Quando true, registra "ignorado por ausência de destinatário". */
  ignored?: boolean;
};

/** Registra envio/falha/ignorado em ProjectNotification (best-effort). */
export async function recordNotification(args: RecordArgs): Promise<void> {
  const type = TYPE_MAP[args.payload.eventType] ?? "STATUS_CHANGED";
  const uiStatus = args.payload.newStatus;
  const status =
    uiStatus && uiStatus in UI_TO_DB_STATUS
      ? UI_TO_DB_STATUS[uiStatus as keyof typeof UI_TO_DB_STATUS]
      : null;
  const errorMessage = args.ignored
    ? "Notificação ignorada por ausência de destinatário (vendedor sem e-mail)."
    : (args.error ?? null);

  const data = {
    type: type as never,
    status: status as never,
    sentToJson: args.sentTo,
    success: args.success,
    errorMessage,
    sentAt: args.success ? new Date() : null,
  };

  try {
    await prisma.projectNotification.upsert({
      where: { notificationKey: args.key },
      create: { projectId: args.payload.projectId, notificationKey: args.key, ...data },
      update: data,
    });
  } catch (e) {
    console.error("[notification-log] falha ao registrar notificação:", (e as Error)?.message);
  }
}
