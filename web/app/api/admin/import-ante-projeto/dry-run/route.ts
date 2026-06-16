import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { dryRunAnteProjetoImport } from "@/server/services/anteProjetoImportService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/admin/import-ante-projeto/dry-run  (application/json)
// Body: { csv: string } — texto do CSV de Ante-Projeto.
// Apenas ADMIN. Simula sem gravar: mostra projetos que seriam deletados + criados.
export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser();
    const { csv } = await req.json();
    const report = await dryRunAnteProjetoImport(actor, csv ?? "");
    return ok(report);
  } catch (e) {
    return fail(e);
  }
}
