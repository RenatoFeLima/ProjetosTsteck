import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { getProject, updateProject, type ProjectInput } from "@/server/services/projectService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireUser();
    const { id } = await ctx.params;
    return ok({ project: await getProject(actor, id) });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as ProjectInput;
    return ok({ project: await updateProject(actor, id, body) });
  } catch (e) {
    return fail(e);
  }
}
