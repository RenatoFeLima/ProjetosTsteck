import { requireUser, HttpError } from "@/server/auth/guards";
import { listAllStatusHistory, listAllReviews } from "@/server/services/projectService";
import { ok, fail } from "@/server/http";
import { startTimer, logPerf } from "@/server/perf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dados agregados de todos os projetos — base dos KPIs de tempo (histórico de
// status) e dos SLAs de revisão (entradas/saídas de revisão).
// Segmento estático "analytics" tem precedência sobre [id], então não conflita.
export async function GET() {
  const stop = startTimer();
  try {
    const actor = await requireUser();
    // Analytics alimenta os KPIs/histórico de status de TODOS os projetos.
    // Gate = kpis.view (NÃO projects.viewHistory): viewHistory é true também para
    // SELLER, então usá-lo deixaria o vendedor passar. kpis.view é true para
    // COMMERCIAL (liberado) e false para SELLER (bloqueado) — regra comercial
    // correta. ADMIN sempre permitido.
    if (actor.role !== "ADMIN" && !actor.permissions.kpis.view) {
      throw new HttpError(403, "Você não tem permissão para ver os indicadores históricos.");
    }
    const [statusHistory, reviews] = await Promise.all([
      listAllStatusHistory(actor),
      listAllReviews(actor),
    ]);
    logPerf("GET /api/projects/analytics", stop(), {
      success: true,
      phases: { status: statusHistory.length, study: reviews.reviewStudy.length, final: reviews.finalReview.length },
    });
    return ok({ statusHistory, reviewStudy: reviews.reviewStudy, finalReview: reviews.finalReview });
  } catch (e) {
    logPerf("GET /api/projects/analytics", stop(), { success: false });
    return fail(e);
  }
}
