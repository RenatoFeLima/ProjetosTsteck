// ─── Tipos compartilhados entre frontend e API route ─────────────────────────
// Este arquivo é importado tanto pelo client quanto pelo server (rota API).
// Não importar aqui nada que seja server-only.

export type ProjectNotificationEventType =
  | "STATUS_CHANGED"
  | "MARKED_URGENT"
  | "URGENCY_REMOVED"
  | "PROJECT_FINISHED"
  | "PROJECT_UPDATED"
  | "PROJECT_CREATED"
  | "PROJECT_RELEASED_TO_ELABORATE_ANTE_PROJECT"
  | "DEADLINE_7_DAYS_LEFT"
  | "DEADLINE_DUE_TODAY"
  | "DEADLINE_OVERDUE";

export type ProjectNotificationPayload = {
  projectId: string;
  projectCode: string;
  constructorName: string;
  workName: string;
  sellerName: string;
  sellerEmail: string;
  equipamento?: string;
  tipoCabine?: string;
  oldStatus?: string;
  newStatus?: string;
  eventType: ProjectNotificationEventType;
  changedBy: string;
  changedAt: string;
  urgencyReason?: string;
  notes?: string;
  /** Prazo total da etapa em dias (ex: 45 para ELABORAR ANTE-PROJETO, 20 para revisões) */
  deadlineDays?: number;
  /** Data limite calculada (ISO date string) */
  dueDate?: string;
  /** Data em que entrou no status atual */
  statusEnteredAt?: string;
  /** Próxima ação recomendada */
  nextAction?: string;
};

/** Registro de notificação enviada — usado para evitar duplicatas */
export type ProjectNotificationRecord = {
  id: string;
  projectId: string;
  type: ProjectNotificationEventType;
  status: string;
  sentTo: string[];
  sentAt: string;
  success: boolean;
  error?: string;
  /** Chave de deduplicação: projectId + type + status + dueDate */
  dedupeKey: string;
};

export type ProjectNotificationResult = {
  success: boolean;
  message: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Retorna os destinatários de e-mail para um projeto.
 * Regras:
 * - to: vendedor responsável (se tiver e-mail válido)
 * - cc: projetos@tsteck.com.br
 * - Se sem vendedor: to = projetos@tsteck.com.br, sem cc
 */
export function getProjectNotificationRecipients(
  sellerEmail: string | undefined,
): { to: string[]; cc?: string[] } {
  const teamEmail = process.env.PROJECTS_TEAM_EMAIL ?? "projetos@tsteck.com.br";
  if (sellerEmail && isValidEmail(sellerEmail)) {
    return { to: [sellerEmail], cc: [teamEmail] };
  }
  return { to: [teamEmail] };
}

/**
 * Envia notificação de movimentação de projeto via API route do Next.js.
 * Fire-and-forget: nunca lança exceção — retorna resultado silenciosamente.
 */
export async function sendProjectNotification(
  payload: ProjectNotificationPayload,
): Promise<ProjectNotificationResult> {
  try {
    const response = await fetch("/api/notifications/project-movement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return data as ProjectNotificationResult;
  } catch {
    return { success: false, message: "Falha na conexão com o servidor de e-mail." };
  }
}

/**
 * Envia notificação de projeto cadastrado via API route do Next.js.
 * Fire-and-forget: nunca lança exceção.
 */
export async function sendProjectCreatedNotification(
  payload: ProjectNotificationPayload,
): Promise<ProjectNotificationResult> {
  try {
    const response = await fetch("/api/notifications/project-created", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return data as ProjectNotificationResult;
  } catch {
    return { success: false, message: "Falha na conexão com o servidor de e-mail." };
  }
}

/**
 * Envia alerta de prazo via API route do Next.js.
 * Fire-and-forget: nunca lança exceção.
 */
export async function sendDeadlineNotification(
  payload: ProjectNotificationPayload,
): Promise<ProjectNotificationResult> {
  try {
    const response = await fetch("/api/notifications/deadline-warning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return data as ProjectNotificationResult;
  } catch {
    return { success: false, message: "Falha na conexão com o servidor de e-mail." };
  }
}

/**
 * Ponto central de notificação de eventos do projeto.
 * Despacha para o endpoint correto com base no tipo de evento.
 * Fire-and-forget: nunca lança exceção.
 */
export async function notifyProjectEvent(
  payload: ProjectNotificationPayload,
): Promise<ProjectNotificationResult> {
  switch (payload.eventType) {
    case "PROJECT_CREATED":
      return sendProjectCreatedNotification(payload);
    case "DEADLINE_7_DAYS_LEFT":
    case "DEADLINE_DUE_TODAY":
    case "DEADLINE_OVERDUE":
      return sendDeadlineNotification(payload);
    default:
      return sendProjectNotification(payload);
  }
}
