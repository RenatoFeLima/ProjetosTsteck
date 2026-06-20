import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { requireSameOrigin } from "@/server/auth/csrf";
import { listEntities, createEntity } from "@/server/services/masterDataService";
import { ok, fail } from "@/server/http";
import { startTimer, logPerf } from "@/server/perf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
  const stop = startTimer();
  try {
    const actor = await requireUser();
    const { entity } = await ctx.params;
    const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";
    const items = await listEntities(actor, entity, includeInactive);
    logPerf(`GET /api/master-data/${entity}`, stop(), { success: true, phases: { count: items.length } });
    return ok({ items });
  } catch (e) {
    logPerf("GET /api/master-data/[entity]", stop(), { success: false });
    return fail(e);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
  const stop = startTimer();
  let entity = "[entity]";
  try {
    requireSameOrigin(req);
    const actor = await requireUser();
    ({ entity } = await ctx.params);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const item = await createEntity(actor, entity, body);
    logPerf(`POST /api/master-data/${entity}`, stop(), { success: true });
    return ok({ item }, 201);
  } catch (e) {
    logPerf(`POST /api/master-data/${entity}`, stop(), { success: false });
    return fail(e);
  }
}
