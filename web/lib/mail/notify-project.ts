// Disparo server-side de notificações de projeto (criação e liberação para
// anteprojeto). Best-effort: NUNCA lança e NUNCA bloqueia criação/mudança de
// status. Regras: somente o vendedor recebe; sem e-mail -> registra ignorado;
// dedup por notificationKey; tudo gravado em ProjectNotification.

import { getProjectNotificationRecipients } from "@/features/projects/services/project-notification-service";
import type { ProjectNotificationPayload } from "@/features/projects/services/project-notification-service";
import { sendProjectMovementEmail, sendProjectCreatedEmail } from "./mail-service";
import { notificationKeyFor, notificationAlreadySent, recordNotification } from "./notification-log";
import { QUEUE_MESSAGE, ELABORATE_MESSAGE } from "./messages";

export { QUEUE_MESSAGE, ELABORATE_MESSAGE };

function escapeHtml(str: unknown): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitize(payload: ProjectNotificationPayload): ProjectNotificationPayload {
  return {
    ...payload,
    projectCode: escapeHtml(payload.projectCode),
    constructorName: escapeHtml(payload.constructorName),
    workName: escapeHtml(payload.workName),
    sellerName: escapeHtml(payload.sellerName),
    newStatus: payload.newStatus ? escapeHtml(payload.newStatus) : undefined,
    changedBy: escapeHtml(payload.changedBy),
    notes: payload.notes ? escapeHtml(payload.notes) : undefined,
    nextAction: payload.nextAction ? escapeHtml(payload.nextAction) : undefined,
  };
}

/**
 * Envia (somente ao vendedor) e registra o resultado. Idempotente por
 * notificationKey. Best-effort: qualquer erro é apenas logado.
 * Deve ser AWAITADO (serverless pode encerrar a função após a resposta).
 */
export async function dispatchProjectNotification(payload: ProjectNotificationPayload): Promise<void> {
  try {
    const recipients = getProjectNotificationRecipients(payload.sellerEmail || undefined);
    const key = notificationKeyFor(payload);

    if (recipients.to.length === 0) {
      await recordNotification({ payload, key, sentTo: [], success: false, ignored: true });
      return;
    }
    if (await notificationAlreadySent(key)) return;

    const send = payload.eventType === "PROJECT_CREATED" ? sendProjectCreatedEmail : sendProjectMovementEmail;
    const result = await send(sanitize(payload), recipients.to);
    await recordNotification({
      payload,
      key,
      sentTo: recipients.to,
      success: result.success,
      error: result.success ? undefined : result.message,
    });
  } catch (e) {
    console.error("[notify-project] falha ao despachar notificação:", (e as Error)?.message);
  }
}
