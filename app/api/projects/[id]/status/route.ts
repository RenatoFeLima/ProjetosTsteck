import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { changeStatus } from "@/server/services/projectService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// body: { status: string (UI ou enum), reason?: string, source?: string, note?: string }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
      return NextResponse.json({ error: "status é obrigatório." }, { status: 400 });
    }
    return ok({ project: await changeStatus(actor, id, status, { reason, source, note }) });
  } catch (e) {
    return fail(e);
  }
}
