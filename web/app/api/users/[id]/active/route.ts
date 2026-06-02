import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { setActive } from "@/server/services/userService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// body: { active: boolean }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const { active } = body as { active?: unknown };
    if (typeof active !== "boolean") {
      return NextResponse.json({ error: "active (boolean) é obrigatório." }, { status: 400 });
    }
    const user = await setActive(actor, id, active);
    return ok({ user });
  } catch (e) {
    return fail(e);
  }
}
