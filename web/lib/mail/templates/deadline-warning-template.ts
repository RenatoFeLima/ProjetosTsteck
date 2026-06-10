import type { ProjectNotificationPayload } from "@/features/projects/services/project-notification-service";
import { formatDateBR } from "@/lib/mail/format-datetime";

const formatDate = formatDateBR;

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    "CADASTRO INICIAL": "Cadastro Inicial",
    "ELABORAR ANTE-PROJETO": "Elaborar Ante-Projeto",
    "ANTE-PROJETO ENVIADO": "Ante-Projeto Enviado",
    "ANTE-PROJETO APROVADO": "Ante-Projeto Aprovado",
    "PROJETO APROVADO": "Projeto Aprovado",
    "PROJETO FINAL ENVIADO": "Projeto Final Enviado",
    "REVISAO DE ESTUDO": "Revisão de Estudo",
    "REVISAO DE PROJETO FINAL": "Revisão de Projeto Final",
  };
  return labels[status] ?? status;
}

export function buildDeadlineWarningTemplate(data: ProjectNotificationPayload): string {
  const isDueToday = data.eventType === "DEADLINE_DUE_TODAY";
  const isOverdue = data.eventType === "DEADLINE_OVERDUE";
  const daysLeft = isDueToday ? 0 : data.deadlineDays;

  const urgencyColor = isOverdue ? "#dc2626" : isDueToday ? "#d97706" : "#2563eb";
  const urgencyBg = isOverdue ? "#fef2f2" : isDueToday ? "#fffbeb" : "#eff6ff";
  const urgencyBorder = isOverdue ? "#fca5a5" : isDueToday ? "#fcd34d" : "#93c5fd";

  let urgencyMessage: string;
  if (isOverdue) {
    urgencyMessage = "⚠️ Este projeto está com o prazo <strong>VENCIDO</strong>. É necessário ação imediata.";
  } else if (isDueToday) {
    urgencyMessage = "⏰ O prazo deste projeto <strong>vence hoje</strong>. Tome as providências necessárias.";
  } else {
    urgencyMessage = `📅 O prazo deste projeto vence em <strong>${daysLeft} dias</strong>. Planeje-se para não atrasar.`;
  }

  const statusRow = data.newStatus
    ? `<tr style="background:#f5f6f8;">
        <td style="padding:8px 12px;color:#71717a;font-size:13px;width:160px;">Status atual</td>
        <td style="padding:8px 12px;font-size:13px;">
          <span style="background:#9e0b0f;color:#fff;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;">
            ${statusLabel(data.newStatus)}
          </span>
        </td>
      </tr>`
    : "";

  const dueDateRow = data.dueDate
    ? `<tr>
        <td style="padding:8px 12px;color:#71717a;font-size:13px;">Data limite</td>
        <td style="padding:8px 12px;font-size:13px;color:${urgencyColor};font-weight:700;">${formatDate(data.dueDate)}</td>
      </tr>`
    : "";

  const nextActionRow = data.nextAction
    ? `<tr style="background:#f5f6f8;">
        <td style="padding:8px 12px;color:#71717a;font-size:13px;">Próxima ação</td>
        <td style="padding:8px 12px;font-size:13px;color:#9e0b0f;font-weight:600;">${data.nextAction}</td>
      </tr>`
    : "";

  const title = isOverdue
    ? "Prazo Vencido"
    : isDueToday
    ? "Prazo Vence Hoje"
    : "Alerta de Prazo";

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:${urgencyColor};padding:24px 28px;">
              <p style="margin:0;color:#fff;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Pipeline de Projetos · TSTECK</p>
              <h1 style="margin:4px 0 0;color:#fff;font-size:20px;font-weight:700;">${title}</h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:20px 28px 4px;">
              <p style="margin:0;font-size:14px;color:#404040;">
                Olá, <strong>${data.sellerName}</strong>:
              </p>
            </td>
          </tr>

          <!-- Urgency banner -->
          <tr>
            <td style="padding:8px 28px;">
              <p style="margin:0;font-size:13px;color:${urgencyColor};background:${urgencyBg};border:1px solid ${urgencyBorder};border-left:3px solid ${urgencyColor};padding:10px 14px;border-radius:6px;">
                ${urgencyMessage}
              </p>
            </td>
          </tr>

          <!-- Project details -->
          <tr>
            <td style="padding:12px 28px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr style="background:#f9fafb;">
                  <td colspan="2" style="padding:10px 12px;font-size:12px;font-weight:700;color:#71717a;letter-spacing:.5px;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">
                    Dados do Projeto
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;color:#71717a;font-size:13px;width:160px;">Código</td>
                  <td style="padding:8px 12px;font-size:13px;font-weight:700;color:#262626;font-family:monospace;">${data.projectCode}</td>
                </tr>
                <tr style="background:#f5f6f8;">
                  <td style="padding:8px 12px;color:#71717a;font-size:13px;">Construtora</td>
                  <td style="padding:8px 12px;font-size:13px;color:#262626;">${data.constructorName}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;color:#71717a;font-size:13px;">Obra</td>
                  <td style="padding:8px 12px;font-size:13px;color:#262626;">${data.workName}</td>
                </tr>
                ${statusRow}
                ${dueDateRow}
                ${nextActionRow}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #e5e7eb;padding:14px 28px;background:#f9fafb;">
              <p style="margin:0;font-size:11px;color:#a3a3a3;text-align:center;">
                TSTECK · Pipeline de Projetos · Este é um e-mail automático, por favor não responda.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
