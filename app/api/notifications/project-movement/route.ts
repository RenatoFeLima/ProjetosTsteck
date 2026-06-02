import { NextRequest, NextResponse } from "next/server";
import { sendProjectMovementEmail } from "@/lib/mail/mail-service";
import {
  getProjectNotificationRecipients,
  isValidEmail,
  type ProjectNotificationPayload,
} from "@/features/projects/services/project-notification-service";

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
  const result = await sendProjectMovementEmail(sanitized, recipients.to, recipients.cc);

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
