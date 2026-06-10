import { NextRequest, NextResponse } from "next/server";
import { sendProjectMovementEmail } from "@/lib/mail/mail-service";
import {
  getProjectNotificationRecipients,
  isValidEmail,
  type ProjectNotificationPayload,
} from "@/features/projects/services/project-notification-service";
import { startTimer, logPerf } from "@/server/perf";
import {
  notificationKeyFor,
  notificationAlreadySent,
  recordNotification,
} from "@/lib/mail/notification-log";

/** Escapa caracteres HTML para evitar injeção no template do e-mail. */
function escapeHtml(str: unknown): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(request: NextRequest) {
  let body: ProjectNotificationPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Payload inválido." }, { status: 400 });
  }

  const { projectId, projectCode, eventType, changedBy, changedAt } = body;

  if (!projectId || !projectCode || !eventType || !changedBy || !changedAt) {
    return NextResponse.json(
      { success: false, message: "Campos obrigatórios ausentes." },
      { status: 400 },
    );
  }

  // Valida o e-mail do vendedor apenas se informado.
  const sellerEmailValid = typeof body.sellerEmail === "string" && isValidEmail(body.sellerEmail);

  // Sanitiza todos os campos de texto usados no HTML do e-mail.
  const sanitized: ProjectNotificationPayload = {
    projectId: escapeHtml(body.projectId),
    projectCode: escapeHtml(body.projectCode),
    constructorName: escapeHtml(body.constructorName),
    workName: escapeHtml(body.workName),
    sellerName: escapeHtml(body.sellerName),
    sellerEmail: sellerEmailValid ? body.sellerEmail : "",
    oldStatus: body.oldStatus ? escapeHtml(body.oldStatus) : undefined,
    newStatus: body.newStatus ? escapeHtml(body.newStatus) : undefined,
    eventType: body.eventType,
    changedBy: escapeHtml(body.changedBy),
    changedAt: body.changedAt,
    urgencyReason: body.urgencyReason ? escapeHtml(body.urgencyReason) : undefined,
    notes: body.notes ? escapeHtml(body.notes) : undefined,
    deadlineDays: body.deadlineDays,
    dueDate: body.dueDate ? escapeHtml(body.dueDate) : undefined,
    statusEnteredAt: body.statusEnteredAt,
    nextAction: body.nextAction ? escapeHtml(body.nextAction) : undefined,
  };

  const recipients = getProjectNotificationRecipients(sellerEmailValid ? body.sellerEmail : undefined);
  const key = notificationKeyFor(body);

  // Notificação é secundária: nunca derruba o fluxo nem retorna 500.
  const stop = startTimer();

  // Sem destinatário (vendedor sem e-mail válido): não envia e registra ignorado.
  if (recipients.to.length === 0) {
    await recordNotification({ payload: body, key, sentTo: [], success: false, ignored: true });
    logPerf("POST /api/notifications/project-movement", stop(), { success: false });
    return NextResponse.json(
      { success: false, message: "Notificação ignorada: vendedor sem e-mail cadastrado." },
      { status: 200 },
    );
  }

  // Idempotência: não reenvia o mesmo evento (mesma chave) já enviado com sucesso.
  if (await notificationAlreadySent(key)) {
    logPerf("POST /api/notifications/project-movement", stop(), { success: true });
    return NextResponse.json(
      { success: true, message: "Notificação já enviada anteriormente (sem duplicar)." },
      { status: 200 },
    );
  }

  try {
    const result = await sendProjectMovementEmail(sanitized, recipients.to);
    await recordNotification({
      payload: body,
      key,
      sentTo: recipients.to,
      success: result.success,
      error: result.success ? undefined : result.message,
    });
    logPerf("POST /api/notifications/project-movement", stop(), { success: result.success });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    await recordNotification({ payload: body, key, sentTo: recipients.to, success: false, error: (err as Error)?.message });
    logPerf("POST /api/notifications/project-movement", stop(), { success: false });
    console.error("[notifications/project-movement] falha ao enviar e-mail:", err);
    return NextResponse.json(
      { success: false, message: "Falha ao enviar e-mail (registrada, fluxo não afetado)." },
      { status: 200 },
    );
  }
}
