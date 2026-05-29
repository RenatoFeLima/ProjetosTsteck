import nodemailer from "nodemailer";
import type { ProjectNotificationPayload } from "@/features/projects/services/project-notification-service";
import { buildProjectMovementTemplate } from "./templates/project-movement-template";
import { buildProjectUrgencyTemplate } from "./templates/project-urgency-template";

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error("[mail-service] SMTP_USER e SMTP_PASS são obrigatórios. Verifique o .env.local.");
  }

  return nodemailer.createTransport({
    host: SMTP_HOST ?? "smtp.gmail.com",
    port: Number(SMTP_PORT ?? 587),
    secure: SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function buildSubject(payload: ProjectNotificationPayload): string {
  switch (payload.eventType) {
    case "MARKED_URGENT":
      return `[URGENTE] Projeto ${payload.projectCode} marcado como prioridade`;
    case "URGENCY_REMOVED":
      return `Projeto ${payload.projectCode} - urgência removida`;
    case "PROJECT_FINISHED":
      return `Projeto ${payload.projectCode} final enviado`;
    case "STATUS_CHANGED":
      if (payload.newStatus === "REVISAO DE ESTUDO") {
        return `Projeto ${payload.projectCode} enviado para revisão de estudo`;
      }
      return `Projeto ${payload.projectCode} alterado para ${payload.newStatus}`;
    default:
      return `Projeto ${payload.projectCode} atualizado no Pipeline TSTECK`;
  }
}

function buildHtml(payload: ProjectNotificationPayload): string {
  if (payload.eventType === "MARKED_URGENT" || payload.eventType === "URGENCY_REMOVED") {
    return buildProjectUrgencyTemplate(payload);
  }
  return buildProjectMovementTemplate(payload);
}

export async function sendProjectMovementEmail(
  payload: ProjectNotificationPayload,
): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = createTransporter();
    const from = process.env.MAIL_FROM ?? process.env.SMTP_USER;

    await transporter.sendMail({
      from,
      to: payload.sellerEmail,
      subject: buildSubject(payload),
      html: buildHtml(payload),
    });

    return { success: true, message: "E-mail enviado com sucesso." };
  } catch (error) {
    console.error("[mail-service] Falha ao enviar e-mail:", error);
    return { success: false, message: "Não foi possível enviar o e-mail." };
  }
}
