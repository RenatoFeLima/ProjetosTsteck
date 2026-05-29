import { NextRequest, NextResponse } from "next/server";
import { sendProjectMovementEmail } from "@/lib/mail/mail-service";
import type { ProjectNotificationPayload } from "@/features/projects/services/project-notification-service";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const { projectId, projectCode, sellerEmail, eventType, changedBy, changedAt } = body;

  if (!projectId || !projectCode || !sellerEmail || !eventType || !changedBy || !changedAt) {
    return NextResponse.json(
      { success: false, message: "Campos obrigatórios ausentes." },
      { status: 400 },
    );
  }

  if (!EMAIL_REGEX.test(sellerEmail)) {
    return NextResponse.json(
      { success: false, message: "E-mail do vendedor inválido." },
      { status: 400 },
    );
  }

  // Sanitiza todos os campos de texto usados no HTML do e-mail.
  const sanitized: ProjectNotificationPayload = {
    projectId: escapeHtml(body.projectId),
    projectCode: escapeHtml(body.projectCode),
    constructorName: escapeHtml(body.constructorName),
    workName: escapeHtml(body.workName),
    sellerName: escapeHtml(body.sellerName),
    sellerEmail: body.sellerEmail, // validado acima, não vai para o HTML
    oldStatus: body.oldStatus ? escapeHtml(body.oldStatus) : undefined,
    newStatus: body.newStatus ? escapeHtml(body.newStatus) : undefined,
    eventType: body.eventType,
    changedBy: escapeHtml(body.changedBy),
    changedAt: body.changedAt,
    urgencyReason: body.urgencyReason ? escapeHtml(body.urgencyReason) : undefined,
    notes: body.notes ? escapeHtml(body.notes) : undefined,
  };

  const result = await sendProjectMovementEmail(sanitized);

  return NextResponse.json(result, { status: result.success ? 200 : 500 });
}
