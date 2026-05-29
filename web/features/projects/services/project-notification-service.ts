// ─── Tipos compartilhados entre frontend e API route ─────────────────────────
// Este arquivo é importado tanto pelo client quanto pelo server (rota API).
// Não importar aqui nada que seja server-only.

export type ProjectNotificationEventType =
  | "STATUS_CHANGED"
  | "MARKED_URGENT"
  | "URGENCY_REMOVED"
  | "PROJECT_FINISHED"
  | "PROJECT_UPDATED";

export type ProjectNotificationPayload = {
  projectId: string;
  projectCode: string;
  constructorName: string;
  workName: string;
  sellerName: string;
  sellerEmail: string;
  oldStatus?: string;
  newStatus?: string;
  eventType: ProjectNotificationEventType;
  changedBy: string;
  changedAt: string;
  urgencyReason?: string;
  notes?: string;
};

export type ProjectNotificationResult = {
  success: boolean;
  message: string;
};

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
