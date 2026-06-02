import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { changeOwnPassword } from "@/server/services/authService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    const { newPassword } = body as { newPassword?: unknown };
    if (typeof newPassword !== "string") {
      return NextResponse.json({ error: "Nova senha é obrigatória." }, { status: 400 });
    }
    const result = await changeOwnPassword(user.id, user.name, newPassword);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
