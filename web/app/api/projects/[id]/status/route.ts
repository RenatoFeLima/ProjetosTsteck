import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { changeStatus } from "@/server/services/projectService";
import { ok, fail } from "@/server/http";
import { startTimer, logPerf } from "@/server/perf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// body: { status: string (UI ou enum), reason?: string, source?: string, note?: string }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const stop = startTimer();
  try {
    const actor = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const { status, reason, source, note } = body as {
      status?: unknown;
      reason?: string;
      source?: string;
      note?: string;
    };
    if (typeof status !== "string") {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Status é obrigatório." },
        { status: 400 },
      );
    }
    const project = await changeStatus(actor, id, status, { reason, source, note });
    logPerf("POST /api/projects/[id]/status", stop(), { success: true });
    return ok({ project });
  } catch (e) {
    logPerf("POST /api/projects/[id]/status", stop(), { success: false });
    return fail(e);
  }
}
