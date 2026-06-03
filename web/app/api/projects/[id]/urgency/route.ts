import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { setUrgency } from "@/server/services/projectService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: marca urgência. body: { reason?: string }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const { reason } = body as { reason?: string };
    return ok({ project: await setUrgency(actor, id, true, reason) });
  } catch (e) {
    return fail(e);
  }
}

// DELETE: remove urgência.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const { reason } = body as { reason?: string };
    return ok({ project: await setUrgency(actor, id, false, reason) });
  } catch (e) {
    return fail(e);
  }
}
