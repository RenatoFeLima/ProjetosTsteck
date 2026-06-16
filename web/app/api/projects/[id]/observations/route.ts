import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { addObservation } from "@/server/services/projectService";
import { ok, fail } from "@/server/http";
import { startTimer, logPerf } from "@/server/perf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// body: { text: string }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const stop = startTimer();
  try {
    const actor = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const { text } = body as { text?: unknown };
    if (typeof text !== "string") {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Texto da observação é obrigatório." },
        { status: 400 },
      );
    }
    const observation = await addObservation(actor, id, text);
    logPerf("POST /api/projects/[id]/observations", stop(), { success: true });
    return ok({ observation }, 201);
  } catch (e) {
    logPerf("POST /api/projects/[id]/observations", stop(), { success: false });
    return fail(e);
  }
}
