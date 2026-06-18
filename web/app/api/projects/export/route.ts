import { requireUser } from "@/server/auth/guards";
import { exportProjectsCsv } from "@/server/services/projectService";
import { fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/projects/export
// Exporta TODOS os projetos do sistema como CSV compatível com Excel (pt-BR).
// Apenas usuários autenticados com permissão de visualização. Somente leitura.
export async function GET() {
  try {
    const actor = await requireUser();
    const { fileName, content } = await exportProjectsCsv(actor);
    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
