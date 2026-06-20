import { NextResponse, type NextRequest } from "next/server";
import * as authService from "@/server/services/authService";
import { setSessionCookie } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/csrf";
import { limitLogin, buildLoginIdentifier } from "@/lib/rate-limit";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);

    const body = await req.json().catch(() => ({}));
    const { username, password } = body as { username?: unknown; password?: unknown };
    if (typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Usuário e senha são obrigatórios." }, { status: 400 });
    }

    // Rate limiting por IP + username: trava força bruta sem punir usuários
    // distintos atrás do mesmo IP corporativo. Verificado ANTES de tocar o banco.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
    const { success, limit, remaining, reset } = await limitLogin(buildLoginIdentifier(ip, username));
    if (!success) {
      return NextResponse.json(
        { error: "RATE_LIMIT", message: "Muitas tentativas. Tente novamente em alguns minutos." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": String(remaining),
            "X-RateLimit-Reset": String(reset),
            "Retry-After": String(Math.max(0, Math.ceil((reset - Date.now()) / 1000))),
          },
        },
      );
    }

    const result = await authService.login(username, password);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    await setSessionCookie(result.user.id);
    return ok({ user: result.user, mustChangePassword: result.mustChangePassword });
  } catch (e) {
    return fail(e);
  }
}
