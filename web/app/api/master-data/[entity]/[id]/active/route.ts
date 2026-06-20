import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { requireSameOrigin } from "@/server/auth/csrf";
import { setEntityActive } from "@/server/services/masterDataService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ entity: string; id: string }> }) {
  try {
    requireSameOrigin(req);
    const actor = await requireUser();
    const { entity, id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const { active } = body as { active?: unknown };
    if (typeof active !== "boolean") {
      return NextResponse.json({ error: "active (boolean) é obrigatório." }, { status: 400 });
    }
    return ok({ item: await setEntityActive(actor, entity, id, active) });
  } catch (e) {
    return fail(e);
  }
}
