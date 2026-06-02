import { NextRequest, NextResponse } from "next/server";
import { sendDeadlineWarningEmail } from "@/lib/mail/mail-service";
import {
  getProjectNotificationRecipients,
  isValidEmail,
} from "@/features/projects/services/project-notification-service";
import type { ProjectNotificationPayload } from "@/features/projects/services/project-notification-service";

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

  const result = await sendDeadlineWarningEmail(sanitized, recipients.to, recipients.cc);

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
