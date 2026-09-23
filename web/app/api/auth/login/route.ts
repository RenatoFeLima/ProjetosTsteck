import { type NextRequest } from "next/server";
import * as authService from "@/server/services/authService";
import { setSessionCookie } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/csrf";
import {
  limitLoginIp,
  peekLoginCredential,
  consumeLoginCredential,
  retryAfterSeconds,
  type RateLimitResult,
} from "@/lib/rate-limit";
import { ok, fail, errorResponse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Headers de observabilidade do rate limit (não são contrato com a UI). */
function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
  };
}

function tooManyRequests(result: RateLimitResult) {
  return errorResponse({
    code: "RATE_LIMIT",
    message: "Muitas tentativas. Tente novamente em alguns minutos.",
    retryAfterSeconds: retryAfterSeconds(result),
    headers: rateLimitHeaders(result),
  });
}

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);

    const body = await req.json().catch(() => ({}));
    const { username, password } = body as { username?: unknown; password?: unknown };
    if (typeof username !== "string" || typeof password !== "string") {
      return errorResponse({
        code: "VALIDATION_ERROR",
        message: "Usuário e senha são obrigatórios.",
      });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";

    // ── Nível 1 — abuso por IP ────────────────────────────────────────────────
    // Consome SEMPRE e não depende do banco: é o que continua protegendo o
    // endpoint quando o MySQL está fora.
    const ipLimit = await limitLoginIp(ip);
    if (!ipLimit.success) return tooManyRequests(ipLimit);

    // ── Nível 2 — credencial inválida (verificação, sem consumir) ─────────────
    // Se já está bloqueado, respondemos 429 SEM tocar no banco.
    const credPeek = await peekLoginCredential(ip, username);
    if (!credPeek.success) return tooManyRequests(credPeek);

    // A partir daqui o banco é acessado. Se ele estiver indisponível, o erro
    // sobe para o `catch` e vira 503 — SEM consumir a quota de credencial.
    const result = await authService.login(username, password);

    if (!result.ok) {
      // Credencial comprovadamente inválida: só AGORA consome o nível 2.
      const consumed = await consumeLoginCredential(ip, username);
      // `success: false` significa que a corrida com outra requisição estourou
      // o limite antes deste incremento — nesse caso o bloqueio já vale.
      if (!consumed.success) return tooManyRequests(consumed);

      // Mensagem idêntica para usuário inexistente e senha incorreta:
      // não permitimos enumeração de usuários pelo login.
      return errorResponse({
        code: "INVALID_CREDENTIALS",
        message: "Usuário ou senha incorretos.",
        headers: rateLimitHeaders(consumed),
      });
    }

    await setSessionCookie(result.user.id);
    // Login válido NÃO consome a quota de credencial.
    return ok({ user: result.user, mustChangePassword: result.mustChangePassword });
  } catch (e) {
    return fail(e);
  }
}
