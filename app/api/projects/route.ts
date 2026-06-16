import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { listProjects, createProject, type ProjectInput } from "@/server/services/projectService";
import { ok, fail } from "@/server/http";
import { startTimer, logPerf } from "@/server/perf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const stop = startTimer();
  try {
    const actor = await requireUser();
    const projects = await listProjects(actor);
    logPerf("GET /api/projects", stop(), { success: true, phases: { count: projects.length } });
    return ok({ projects });
  } catch (e) {
    logPerf("GET /api/projects", stop(), { success: false });
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  const stop = startTimer();
  try {
    const actor = await requireUser();
    const body = (await req.json().catch(() => ({}))) as ProjectInput;
    const project = await createProject(actor, body);
    logPerf("POST /api/projects", stop(), { success: true });
    return ok({ project }, 201);
  } catch (e) {
    logPerf("POST /api/projects", stop(), { success: false });
    return fail(e);
  }
}
