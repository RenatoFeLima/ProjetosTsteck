import { requireUser } from "@/server/auth/guards";
import { nextCodeSuggestion } from "@/server/services/projectService";
import { ok, fail } from "@/server/http";
import { startTimer, logPerf } from "@/server/perf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sugestão do próximo código final. A referência é o último projeto que chegou
// em PROJETO_APROVADO (terminal). `currentCode` (query) é o código provisório do
// projeto sendo movimentado — usado como fallback e info secundária no modal.
export async function GET(req: Request) {
  const stop = startTimer();
  try {
    const actor = await requireUser();
    const currentCode = new URL(req.url).searchParams.get("currentCode") ?? undefined;
    const result = await nextCodeSuggestion(actor, currentCode);
    logPerf("GET /api/projects/next-code-suggestion", stop(), { success: true });
    return ok(result);
  } catch (e) {
    logPerf("GET /api/projects/next-code-suggestion", stop(), { success: false });
    return fail(e);
  }
}
