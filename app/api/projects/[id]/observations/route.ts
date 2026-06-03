import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { addObservation } from "@/server/services/projectService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// body: { text: string }
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const { text } = body as { text?: unknown };
    if (typeof text !== "string") {
      return NextResponse.json({ error: "text é obrigatório." }, { status: 400 });
    }
    return ok({ observation: await addObservation(actor, id, text) }, 201);
  } catch (e) {
    return fail(e);
  }
}
