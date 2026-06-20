import { type NextRequest } from "next/server";
import { requireUser, HttpError } from "@/server/auth/guards";
import { requireSameOrigin } from "@/server/auth/csrf";
import { isValidEmail } from "@/features/projects/services/project-notification-service";
import { sendTestEmail, verifySmtp, smtpConfigSummary } from "@/lib/mail/mail-service";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/test-smtp  body: { to: string }
// Apenas ADMIN. Autentica no SMTP, envia um e-mail de teste e retorna o
// resultado REAL (sucesso/falha + erro), além de um resumo da config SEM expor a
// senha. Não depende de projeto/status — isola "é SMTP ou é fluxo de projetos?".
export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const actor = await requireUser();
    if (actor.role !== "ADMIN") {
      throw new HttpError(403, "Apenas administradores podem testar o SMTP.");
    }

    const body = (await req.json().catch(() => ({}))) as { to?: unknown };
    const to = typeof body.to === "string" ? body.to.trim() : "";
    if (!to || !isValidEmail(to)) {
      throw new HttpError(400, "Informe um e-mail de destino válido em { to }.");
    }

    const config = smtpConfigSummary();
    const verify = await verifySmtp();
    const result = await sendTestEmail(to);

    // Log seguro (sem senha) para os Runtime Logs da Vercel.
    console.info(
      `[admin/test-smtp] to=${to} verify=${verify.ok} sent=${result.success} ` +
        `host=${config.host} port=${config.port} secure=${config.secure} ` +
        `user=${config.user} hasPass=${config.hasPass}` +
        `${result.error ? ` error=${result.error}` : ""}`,
    );

    return ok({
      config,
      verify,
      sent: result.success,
      messageId: result.messageId,
      error: result.error,
      code: result.code,
    });
  } catch (e) {
    return fail(e);
  }
}
