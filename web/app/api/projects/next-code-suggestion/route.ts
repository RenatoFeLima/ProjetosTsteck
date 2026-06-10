import { requireUser } from "@/server/auth/guards";
import { nextCodeSuggestion } from "@/server/services/projectService";
import { ok, fail } from "@/server/http";
import { startTimer, logPerf } from "@/server/perf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sugestão do próximo código (sufixo global +1). Segmento estático, sem conflito
// com [id]. O cliente combina o sufixo com o prefixo do projeto (editável).
export async function GET() {
  const stop = startTimer();
  try {
    const actor = await requireUser();
    const result = await nextCodeSuggestion(actor);
    logPerf("GET /api/projects/next-code-suggestion", stop(), { success: true });
    return ok(result);
  } catch (e) {
    logPerf("GET /api/projects/next-code-suggestion", stop(), { success: false });
    return fail(e);
  }
}
