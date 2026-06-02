import nodemailer from "nodemailer";
import type { ProjectNotificationPayload } from "@/features/projects/services/project-notification-service";
import { buildProjectMovementTemplate } from "./templates/project-movement-template";
import { buildProjectUrgencyTemplate } from "./templates/project-urgency-template";
import { buildProjectCreatedTemplate } from "./templates/project-created-template";
import { buildDeadlineWarningTemplate } from "./templates/deadline-warning-template";

const PROJECTS_TEAM_EMAIL =
  process.env.PROJECTS_TEAM_EMAIL ?? "projetos@tsteck.com.br";

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
    case "PROJECT_CREATED":
      return `Novo projeto cadastrado: ${payload.projectCode} - ${payload.workName}`;
    case "DEADLINE_7_DAYS_LEFT":
      return `[AVISO] Projeto ${payload.projectCode} vence em 7 dias`;
    case "DEADLINE_DUE_TODAY":
      return `[URGENTE] Projeto ${payload.projectCode} vence hoje`;
    case "DEADLINE_OVERDUE":
      return `[VENCIDO] Projeto ${payload.projectCode} com prazo expirado`;
    case "STATUS_CHANGED":
      if (payload.newStatus === "REVISAO DE ESTUDO") {
        return `Projeto ${payload.projectCode} enviado para revisão de estudo`;
      }
      if (payload.newStatus === "REVISAO DE PROJETO FINAL") {
        return `Projeto ${payload.projectCode} enviado para revisão de projeto final`;
      }
      return `Projeto ${payload.projectCode} alterado para ${payload.newStatus}`;
    case "PROJECT_RELEASED_TO_ELABORATE_ANTE_PROJECT":
      return `Projeto ${payload.projectCode} liberado para elaboração de anteprojeto`;
    default:
      return `Projeto ${payload.projectCode} atualizado no Pipeline TSTECK`;
  }
}

function buildHtml(payload: ProjectNotificationPayload): string {
  if (payload.eventType === "MARKED_URGENT" || payload.eventType === "URGENCY_REMOVED") {
    return buildProjectUrgencyTemplate(payload);
  }
  if (payload.eventType === "PROJECT_CREATED") {
    return buildProjectCreatedTemplate(payload);
  }
  if (
    payload.eventType === "DEADLINE_7_DAYS_LEFT" ||
    payload.eventType === "DEADLINE_DUE_TODAY" ||
    payload.eventType === "DEADLINE_OVERDUE"
  ) {
    return buildDeadlineWarningTemplate(payload);
  }
  return buildProjectMovementTemplate(payload);
}

export async function sendProjectMovementEmail(
  payload: ProjectNotificationPayload,
  to: string[],
  cc?: string[],
): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = createTransporter();
    const from = process.env.MAIL_FROM ?? process.env.SMTP_USER;

    console.info(
      `[MAIL] Enviando ${payload.eventType} para projeto ${payload.projectCode} → to:[${to.join(", ")}]${
        cc?.length ? ` cc:[${cc.join(", ")}]` : ""
      }`,
    );

    await transporter.sendMail({
      from,
      to: to.join(", "),
      ...(cc && cc.length ? { cc: cc.join(", ") } : {}),
      subject: buildSubject(payload),
      html: buildHtml(payload),
    });

    return { success: true, message: "E-mail enviado com sucesso." };
  } catch (error) {
    console.error(
      `[MAIL_ERROR] Falha ao enviar ${payload.eventType} para projeto ${payload.projectCode}: ${
        (error as Error)?.message ?? "erro desconhecido"
      }`,
    );
    return { success: false, message: "Não foi possível enviar o e-mail." };
  }
}

export async function sendProjectCreatedEmail(
  payload: ProjectNotificationPayload,
  to: string[],
  cc?: string[],
): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = createTransporter();
    const from = process.env.MAIL_FROM ?? process.env.SMTP_USER;

    await transporter.sendMail({
      from,
      to: to.join(", "),
      ...(cc && cc.length ? { cc: cc.join(", ") } : {}),
      subject: buildSubject(payload),
      html: buildProjectCreatedTemplate(payload),
    });

    return { success: true, message: "E-mail de cadastro enviado com sucesso." };
  } catch (error) {
    console.error("[mail-service] Falha ao enviar e-mail de cadastro:", error);
    return { success: false, message: "Não foi possível enviar o e-mail de cadastro." };
  }
}

export async function sendDeadlineWarningEmail(
  payload: ProjectNotificationPayload,
  to: string[],
  cc?: string[],
): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = createTransporter();
    const from = process.env.MAIL_FROM ?? process.env.SMTP_USER;

    await transporter.sendMail({
      from,
      to: to.join(", "),
      ...(cc && cc.length ? { cc: cc.join(", ") } : {}),
      subject: buildSubject(payload),
      html: buildDeadlineWarningTemplate(payload),
    });

    return { success: true, message: "E-mail de alerta de prazo enviado." };
  } catch (error) {
    console.error("[mail-service] Falha ao enviar e-mail de prazo:", error);
    return { success: false, message: "Não foi possível enviar o e-mail de prazo." };
  }
}
