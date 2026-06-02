import type { ProjectNotificationPayload } from "@/features/projects/services/project-notification-service";

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

export function buildProjectUrgencyTemplate(data: ProjectNotificationPayload): string {
  const isRemoval = data.eventType === "URGENCY_REMOVED";

  const headerColor = isRemoval ? "#71717a" : "#9e0b0f";
  const badgeText = isRemoval ? "Urgência Removida" : "PROJETO URGENTE";
  const icon = isRemoval ? "✓" : "⚠";
  const title = isRemoval
    ? `Projeto ${data.projectCode} — urgência removida`
    : `Projeto ${data.projectCode} marcado como URGENTE`;

  const urgencyBlock = !isRemoval && data.urgencyReason
    ? `<tr>
        <td style="padding:16px 32px 8px;">
          <div style="background:#fff8f8;border-left:4px solid #9e0b0f;padding:14px 16px;border-radius:0 8px 8px 0;">
            <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:#9e0b0f;text-transform:uppercase;margin-bottom:6px;">Justificativa da urgência</div>
            <p style="margin:0;font-size:14px;color:#262626;line-height:1.6;">${data.urgencyReason}</p>
          </div>
        </td>
      </tr>`
    : "";

  const removalNote = isRemoval
    ? `<tr>
        <td style="padding:16px 32px 8px;">
          <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:14px 16px;border-radius:0 8px 8px 0;">
            <p style="margin:0;font-size:14px;color:#262626;line-height:1.6;">
              O projeto voltou ao fluxo normal de prioridade.
            </p>
          </div>
        </td>
      </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:${headerColor};padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.7);text-transform:uppercase;margin-bottom:4px;">TSTECK ENGENHARIA</div>
                    <div style="font-size:22px;font-weight:700;color:#ffffff;">Pipeline de Projetos</div>
                  </td>
                  <td align="right">
                    <span style="background:rgba(255,255,255,0.25);color:#fff;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:0.5px;">
                      ${icon} ${badgeText}
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
                ${isRemoval
                  ? "A urgência do projeto abaixo foi <strong>removida</strong>."
                  : "O projeto abaixo foi <strong>marcado como urgente</strong> e requer sua atenção."}
              </p>
            </td>
          </tr>

          ${urgencyBlock}
          ${removalNote}

          <!-- Project data table -->
          <tr>
            <td style="padding:16px 32px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
                <tr style="background:#f5f6f8;">
                  <td colspan="2" style="padding:10px 12px;font-size:11px;font-weight:700;letter-spacing:1px;color:${headerColor};text-transform:uppercase;border-bottom:1px solid #e5e7eb;">
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
                <tr style="background:#f5f6f8;">
                  <td style="padding:8px 12px;color:#71717a;font-size:13px;">Status atual</td>
                  <td style="padding:8px 12px;font-size:13px;color:#262626;">${data.newStatus ?? "—"}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;color:#71717a;font-size:13px;">${isRemoval ? "Removido por" : "Marcado por"}</td>
                  <td style="padding:8px 12px;font-size:13px;color:#262626;">${data.changedBy}</td>
                </tr>
                <tr style="background:#f5f6f8;">
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
