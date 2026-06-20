import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { requireSameOrigin } from "@/server/auth/csrf";
import { dryRunFinalProjectsImport } from "@/server/services/finalProjectsImportService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/admin/import-final-projects/dry-run  (application/json)
// Body: { csv: string } — CSV de projetos finais/aprovados.
// Apenas ADMIN. Simula sem gravar: mostra match por construtora+obra e o impacto.
export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const actor = await requireUser();
    const { csv } = await req.json();
    const report = await dryRunFinalProjectsImport(actor, csv ?? "");
    return ok(report);
  } catch (e) {
    return fail(e);
  }
}
