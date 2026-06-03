import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { getHistory } from "@/server/services/projectService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireUser();
    const { id } = await ctx.params;
    return ok(await getHistory(actor, id));
  } catch (e) {
    return fail(e);
  }
}
