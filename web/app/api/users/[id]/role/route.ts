import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { requireSameOrigin } from "@/server/auth/csrf";
import { promoteToAdmin, revokeAdmin } from "@/server/services/userService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// body: { action: "promote" | "revoke" }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(req);
    const actor = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const { action } = body as { action?: unknown };

    if (action === "promote") return ok({ user: await promoteToAdmin(actor, id) });
    if (action === "revoke") return ok({ user: await revokeAdmin(actor, id) });
    return NextResponse.json({ error: 'action deve ser "promote" ou "revoke".' }, { status: 400 });
  } catch (e) {
    return fail(e);
  }
}
