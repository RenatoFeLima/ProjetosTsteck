import type { ProjectNotificationPayload } from "@/features/projects/services/project-notification-service";

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    "CADASTRO INICIAL": "Cadastro Inicial",
    "ELABORAR ANTE-PROJETO": "Elaborar Ante-Projeto",
    "ANTE-PROJETO ENVIADO": "Ante-Projeto Enviado",
    "ANTE-PROJETO APROVADO": "Ante-Projeto Aprovado",
    "PROJETO APROVADO": "Projeto Aprovado",
    "PROJETO FINAL ENVIADO": "Projeto Final Enviado",
    "REVISAO DE ESTUDO": "Revisão de Estudo",
  };
  return labels[status] ?? status;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function buildProjectMovementTemplate(data: ProjectNotificationPayload): string {
  const statusRow = data.oldStatus && data.newStatus
    ? `
      <tr>
        <td style="padding:8px 12px;color:#71717a;font-size:13px;width:160px;">Status anterior</td>
        <td style="padding:8px 12px;font-size:13px;color:#262626;">${statusLabel(data.oldStatus)}</td>
      </tr>
      <tr style="background:#f5f6f8;">
        <td style="padding:8px 12px;color:#71717a;font-size:13px;">Novo status</td>
        <td style="padding:8px 12px;font-size:13px;">
          <span style="background:#9e0b0f;color:#fff;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;">
            ${statusLabel(data.newStatus)}
          </span>
        </td>
      </tr>`
    : "";

  const urgencyRow = data.urgencyReason
    ? `<tr>
        <td style="padding:8px 12px;color:#71717a;font-size:13px;">Justificativa</td>
        <td style="padding:8px 12px;font-size:13px;color:#262626;">${data.urgencyReason}</td>
      </tr>`
    : "";

  const notesRow = data.notes
    ? `<tr style="background:#f5f6f8;">
        <td style="padding:8px 12px;color:#71717a;font-size:13px;">Observação</td>
        <td style="padding:8px 12px;font-size:13px;color:#262626;font-style:italic;">${data.notes}</td>
      </tr>`
    : "";

  const eventBadge: Record<string, string> = {
    STATUS_CHANGED: "Mudança de Status",
    MARKED_URGENT: "Projeto Urgente",
    URGENCY_REMOVED: "Urgência Removida",
    PROJECT_FINISHED: "Projeto Finalizado",
    PROJECT_UPDATED: "Dados Atualizados",
  };

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Atualização de Projeto - TSTECK</title>
</head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#9e0b0f;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.7);text-transform:uppercase;margin-bottom:4px;">TSTECK ENGENHARIA</div>
                    <div style="font-size:22px;font-weight:700;color:#ffffff;">Pipeline de Projetos</div>
                  </td>
                  <td align="right">
                    <span style="background:rgba(255,255,255,0.18);color:#fff;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.5px;">
                      ${eventBadge[data.eventType] ?? "Notificação"}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:28px 32px 12px;">
              <p style="margin:0;font-size:16px;color:#262626;">
                Olá, <strong>${data.sellerName}</strong>.
              </p>
              <p style="margin:8px 0 0;font-size:14px;color:#71717a;line-height:1.6;">
                O projeto abaixo teve uma movimentação no Pipeline de Projetos TSTECK.
                Acompanhe os detalhes:
              </p>
            </td>
          </tr>

          <!-- Project data table -->
          <tr>
            <td style="padding:8px 32px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr style="background:#f5f6f8;">
                  <td colspan="2" style="padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:1px;color:#9e0b0f;text-transform:uppercase;border-bottom:1px solid #e5e7eb;">
                    Dados do Projeto
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;color:#71717a;font-size:13px;width:160px;">Código</td>
                  <td style="padding:8px 12px;font-size:13px;font-weight:700;font-family:monospace;color:#262626;">${data.projectCode}</td>
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
                ${urgencyRow}
                ${notesRow}
                <tr style="background:#f5f6f8;">
                  <td style="padding:8px 12px;color:#71717a;font-size:13px;">Alterado por</td>
                  <td style="padding:8px 12px;font-size:13px;color:#262626;">${data.changedBy}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;color:#71717a;font-size:13px;">Data/hora</td>
                  <td style="padding:8px 12px;font-size:13px;color:#262626;">${formatDate(data.changedAt)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f5f6f8;padding:20px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;line-height:1.6;">
                E-mail automático enviado pelo <strong>Pipeline de Projetos - TSTECK</strong>.<br/>
                Não responda esta mensagem.
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
