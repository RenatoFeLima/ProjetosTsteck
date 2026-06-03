import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { updateEntity } from "@/server/services/masterDataService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ entity: string; id: string }> }) {
  try {
    const actor = await requireUser();
    const { entity, id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return ok({ item: await updateEntity(actor, entity, id, body) });
  } catch (e) {
    return fail(e);
  }
}
