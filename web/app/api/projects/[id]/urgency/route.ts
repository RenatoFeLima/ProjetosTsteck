import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { setUrgency } from "@/server/services/projectService";
import { ok, fail } from "@/server/http";
import { startTimer, logPerf } from "@/server/perf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: marca urgência. body: { reason: string, deadline: string }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const stop = startTimer();
  try {
    const actor = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const { reason, deadline } = body as { reason?: string; deadline?: string };
    const project = await setUrgency(actor, id, true, reason, deadline);
    logPerf("POST /api/projects/[id]/urgency", stop(), { success: true });
    return ok({ project });
  } catch (e) {
    logPerf("POST /api/projects/[id]/urgency", stop(), { success: false });
    return fail(e);
  }
}

// DELETE: remove urgência.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const stop = startTimer();
  try {
    const actor = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const { reason } = body as { reason?: string };
    const project = await setUrgency(actor, id, false, reason);
    logPerf("DELETE /api/projects/[id]/urgency", stop(), { success: true });
    return ok({ project });
  } catch (e) {
    logPerf("DELETE /api/projects/[id]/urgency", stop(), { success: false });
    return fail(e);
  }
}
