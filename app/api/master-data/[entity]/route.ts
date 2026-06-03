import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { listEntities, createEntity } from "@/server/services/masterDataService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
  try {
    const actor = await requireUser();
    const { entity } = await ctx.params;
    const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";
    return ok({ items: await listEntities(actor, entity, includeInactive) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ entity: string }> }) {
  try {
    const actor = await requireUser();
    const { entity } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return ok({ item: await createEntity(actor, entity, body) }, 201);
  } catch (e) {
    return fail(e);
  }
}
