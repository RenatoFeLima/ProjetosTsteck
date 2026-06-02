import { NextResponse, type NextRequest } from "next/server";
import * as authService from "@/server/services/authService";
import { setSessionCookie } from "@/server/auth/session";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { username, password } = body as { username?: unknown; password?: unknown };
    if (typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Usuário e senha são obrigatórios." }, { status: 400 });
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
