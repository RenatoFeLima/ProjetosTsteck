import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { listProjects, createProject, type ProjectInput } from "@/server/services/projectService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await requireUser();
    return ok({ projects: await listProjects(actor) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser();
    const body = (await req.json().catch(() => ({}))) as ProjectInput;
    return ok({ project: await createProject(actor, body) }, 201);
  } catch (e) {
    return fail(e);
  }
}
