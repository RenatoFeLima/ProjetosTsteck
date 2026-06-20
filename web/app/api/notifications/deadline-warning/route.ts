import { NextRequest, NextResponse } from "next/server";
import { requireSameOrigin } from "@/server/auth/csrf";
import { HttpError } from "@/server/auth/guards";
import { sendDeadlineWarningEmail } from "@/lib/mail/mail-service";
import {
  getProjectNotificationRecipients,
  isValidEmail,
} from "@/features/projects/services/project-notification-service";
import type { ProjectNotificationPayload } from "@/features/projects/services/project-notification-service";
import {
  notificationKeyFor,
  notificationAlreadySent,
  recordNotification,
} from "@/lib/mail/notification-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Escapa caracteres HTML para evitar injeção no template de e-mail. */
function escapeHtml(str: unknown): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const VALID_DEADLINE_EVENTS = new Set([
  "DEADLINE_7_DAYS_LEFT",
  "DEADLINE_DUE_TODAY",
  "DEADLINE_OVERDUE",
]);

export async function POST(request: NextRequest) {
  try {
    requireSameOrigin(request);
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.code, message: e.message }, { status: e.status });
    throw e;
  }

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

  if (!VALID_DEADLINE_EVENTS.has(eventType)) {
    return NextResponse.json(
      { success: false, message: "Tipo de evento inválido para esta rota." },
      { status: 400 },
    );
  }

  const sellerEmailValid = body.sellerEmail && isValidEmail(body.sellerEmail);

  const sanitized: ProjectNotificationPayload = {
    projectId: escapeHtml(body.projectId),
    projectCode: escapeHtml(body.projectCode),
    constructorName: escapeHtml(body.constructorName),
    workName: escapeHtml(body.workName),
    sellerName: escapeHtml(body.sellerName),
    sellerEmail: sellerEmailValid ? body.sellerEmail : "",
    newStatus: body.newStatus ? escapeHtml(body.newStatus) : undefined,
    eventType: body.eventType,
    changedBy: escapeHtml(body.changedBy),
    changedAt: body.changedAt,
    deadlineDays: body.deadlineDays,
    dueDate: body.dueDate ? escapeHtml(body.dueDate) : undefined,
    statusEnteredAt: body.statusEnteredAt,
    nextAction: body.nextAction ? escapeHtml(body.nextAction) : undefined,
  };

  const recipients = getProjectNotificationRecipients(
    sellerEmailValid ? body.sellerEmail : undefined,
  );
  const key = notificationKeyFor(body);

  if (recipients.to.length === 0) {
    await recordNotification({ payload: body, key, sentTo: [], success: false, ignored: true });
    return NextResponse.json(
      { success: false, message: "Notificação ignorada: vendedor sem e-mail cadastrado." },
      { status: 200 },
    );
  }

  if (await notificationAlreadySent(key)) {
    return NextResponse.json(
      { success: true, message: "Notificação já enviada anteriormente (sem duplicar)." },
      { status: 200 },
    );
  }

  try {
    const result = await sendDeadlineWarningEmail(sanitized, recipients.to);
    await recordNotification({
      payload: body,
      key,
      sentTo: recipients.to,
      success: result.success,
      error: result.success ? undefined : result.message,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    await recordNotification({ payload: body, key, sentTo: recipients.to, success: false, error: (err as Error)?.message });
    console.error("[notifications/deadline-warning] falha ao enviar e-mail:", err);
    return NextResponse.json(
      { success: false, message: "Falha ao enviar e-mail (registrada, fluxo não afetado)." },
      { status: 200 },
    );
  }
}
