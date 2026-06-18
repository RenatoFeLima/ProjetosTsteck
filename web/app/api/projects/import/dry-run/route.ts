import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { dryRunProjectsExcel } from "@/server/services/projectsExcelImportService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/projects/import/dry-run  (application/json)
// Body: { csv: string } — CSV exportado pelo sistema (com coluna "ID do Projeto").
// Apenas ADMIN. Simula sem gravar: mostra alterações before → after por projeto.
export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser();
    const { csv } = await req.json();
    const report = await dryRunProjectsExcel(actor, csv ?? "");
    return ok(report);
  } catch (e) {
    return fail(e);
  }
}
