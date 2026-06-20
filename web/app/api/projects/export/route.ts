import { requireUser, HttpError } from "@/server/auth/guards";
import { exportProjectsCsv } from "@/server/services/projectService";
import { fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/projects/export
// Exporta TODOS os projetos do sistema como CSV compatível com Excel (pt-BR).
// Regra: ADMIN ou permissão de exportação. O schema de permissões NÃO tem
// `projects.export` — a capacidade de exportar é modelada como `kpis.export`
// (o equivalente real). Com isso: SELLER (kpis.export=false) e COMMERCIAL
// (kpis.export=false) ficam bloqueados; ADMIN sempre permitido. Somente leitura.
export async function GET() {
  try {
    const actor = await requireUser();
    if (actor.role !== "ADMIN" && !actor.permissions.kpis.export) {
      throw new HttpError(403, "Você não tem permissão para exportar projetos.");
    }
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
