import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { requireSameOrigin } from "@/server/auth/csrf";
import { updateUser, type UpdateUserPatch } from "@/server/services/userService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(req);
    const actor = await requireUser();
    const { id } = await ctx.params;
    const patch = (await req.json().catch(() => ({}))) as UpdateUserPatch;
    const user = await updateUser(actor, id, patch);
    return ok({ user });
  } catch (e) {
    return fail(e);
  }
}
