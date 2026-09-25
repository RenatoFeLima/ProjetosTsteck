// ─── Tipos e regras de destinatário das notificações de projeto ─────────────
// Usado pelo envio no SERVIDOR (lib/mail, jobs). O navegador não dispara mais
// e-mails: não há rotas /api/notifications/* chamadas pelo cliente.
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Destinatários de e-mail de um projeto.
 * Regra (única): SOMENTE o vendedor responsável recebe.
 * - to: [e-mail do vendedor] quando válido.
 * - Sem vendedor ou sem e-mail válido: `to` vazio → o chamador NÃO envia e
 *   registra a notificação como ignorada por ausência de destinatário.
 * Não há mais cópia/CC/BCC para o time (projetos@tsteck.com.br foi removido).
 */
export function getProjectNotificationRecipients(
  sellerEmail: string | undefined,
): { to: string[] } {
  if (sellerEmail && isValidEmail(sellerEmail)) {
    return { to: [sellerEmail] };
  }
  return { to: [] };
}
