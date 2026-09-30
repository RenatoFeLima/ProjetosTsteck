import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { requireSameOrigin } from "@/server/auth/csrf";
import { regressStatus } from "@/server/services/projectService";
import { ok, fail } from "@/server/http";
import { startTimer, logPerf } from "@/server/perf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Regressão administrativa de status (somente ADMIN — checado no service).
// body: { toStatus, reason }. Origem, ator, perfil e status atual são sempre
// determinados pelo servidor; qualquer outro campo do payload é ignorado.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const stop = startTimer();
  try {
    requireSameOrigin(req);
    const actor = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const { toStatus, reason } = body as { toStatus?: unknown; reason?: unknown };
    const project = await regressStatus(actor, id, toStatus, reason);
    logPerf("POST /api/projects/[id]/status-regression", stop(), { success: true });
    return ok({ project });
  } catch (e) {
    logPerf("POST /api/projects/[id]/status-regression", stop(), { success: false });
    return fail(e);
  }
}
