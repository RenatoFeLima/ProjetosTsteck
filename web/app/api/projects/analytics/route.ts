import { requireUser } from "@/server/auth/guards";
import { listAllStatusHistory } from "@/server/services/projectService";
import { ok, fail } from "@/server/http";
import { startTimer, logPerf } from "@/server/perf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Histórico de status agregado de todos os projetos — base dos KPIs de tempo.
// Segmento estático "analytics" tem precedência sobre [id], então não conflita.
export async function GET() {
  const stop = startTimer();
  try {
    const actor = await requireUser();
    const statusHistory = await listAllStatusHistory(actor);
    logPerf("GET /api/projects/analytics", stop(), { success: true, phases: { count: statusHistory.length } });
    return ok({ statusHistory });
  } catch (e) {
    logPerf("GET /api/projects/analytics", stop(), { success: false });
    return fail(e);
  }
}
