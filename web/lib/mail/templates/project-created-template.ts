import type { ProjectNotificationPayload } from "@/features/projects/services/project-notification-service";
import { formatDateTimeBR } from "@/lib/mail/format-datetime";

const formatDate = formatDateTimeBR;

export function buildProjectCreatedTemplate(data: ProjectNotificationPayload): string {
  const equipamentoRow = data.equipamento
    ? `<tr style="background:#f5f6f8;">
        <td style="padding:8px 12px;color:#71717a;font-size:13px;width:160px;">Equipamento</td>
        <td style="padding:8px 12px;font-size:13px;color:#262626;">${data.equipamento}</td>
      </tr>`
    : "";

  const tipoCabineRow = data.tipoCabine
    ? `<tr>
        <td style="padding:8px 12px;color:#71717a;font-size:13px;">Tipo de Cabine</td>
        <td style="padding:8px 12px;font-size:13px;color:#262626;">${data.tipoCabine}</td>
      </tr>`
    : "";

  const nextActionRow = data.nextAction
    ? `<tr style="background:#f5f6f8;">
        <td style="padding:8px 12px;color:#71717a;font-size:13px;">Próxima Ação</td>
        <td style="padding:8px 12px;font-size:13px;color:#9e0b0f;font-weight:600;">${data.nextAction}</td>
      </tr>`
    : "";

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Novo Projeto Cadastrado</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:#9e0b0f;padding:24px 28px;">
              <p style="margin:0;color:#fff;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Pipeline de Projetos · TSTECK</p>
              <h1 style="margin:4px 0 0;color:#fff;font-size:20px;font-weight:700;">Novo Projeto Cadastrado</h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:20px 28px 4px;">
              <p style="margin:0;font-size:14px;color:#404040;">
                Olá, <strong>${data.sellerName}</strong> — um novo projeto foi cadastrado no sistema e está aguardando sua ação.
              </p>
            </td>
          </tr>

          <!-- Project details -->
          <tr>
            <td style="padding:16px 28px;">
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
                ${equipamentoRow}
                ${tipoCabineRow}
                <tr style="${data.tipoCabine ? "" : "background:#f5f6f8;"}">
                  <td style="padding:8px 12px;color:#71717a;font-size:13px;">Cadastrado em</td>
                  <td style="padding:8px 12px;font-size:13px;color:#262626;">${formatDate(data.changedAt)}</td>
                </tr>
                <tr style="background:#f5f6f8;">
                  <td style="padding:8px 12px;color:#71717a;font-size:13px;">Cadastrado por</td>
                  <td style="padding:8px 12px;font-size:13px;color:#262626;">${data.changedBy}</td>
                </tr>
                ${nextActionRow}
              </table>
            </td>
          </tr>

          <!-- CTA note -->
          <tr>
            <td style="padding:4px 28px 20px;">
              <p style="margin:0;font-size:13px;color:#525252;background:#fef2f2;border-left:3px solid #9e0b0f;padding:10px 14px;border-radius:0 6px 6px 0;">
                Acesse o Pipeline de Projetos para acompanhar o andamento e registrar as próximas etapas.
              </p>
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
