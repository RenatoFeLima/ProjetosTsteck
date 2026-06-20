import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { requireSameOrigin } from "@/server/auth/csrf";
import { updateEntity } from "@/server/services/masterDataService";
import { ok, fail } from "@/server/http";
import { startTimer, logPerf } from "@/server/perf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ entity: string; id: string }> }) {
  const stop = startTimer();
  let entity = "[entity]";
  try {
    requireSameOrigin(req);
    const actor = await requireUser();
    let id: string;
    ({ entity, id } = await ctx.params);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const item = await updateEntity(actor, entity, id, body);
    logPerf(`PATCH /api/master-data/${entity}/[id]`, stop(), { success: true });
    return ok({ item });
  } catch (e) {
    logPerf(`PATCH /api/master-data/${entity}/[id]`, stop(), { success: false });
    return fail(e);
  }
}
