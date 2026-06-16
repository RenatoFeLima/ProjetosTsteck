import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { resetPassword } from "@/server/services/userService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const { newPassword } = body as { newPassword?: unknown };
    if (typeof newPassword !== "string") {
      return NextResponse.json({ error: "Nova senha é obrigatória." }, { status: 400 });
    }
    await resetPassword(actor, id, newPassword);
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
