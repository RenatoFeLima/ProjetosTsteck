import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { commitFinalProjectsImport } from "@/server/services/finalProjectsImportService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/admin/import-final-projects/commit  (application/json)
// Body: { csv: string } — CSV de projetos finais/aprovados.
// Apenas ADMIN. Gera backup obrigatório e atualiza projetos no escopo
// (PROJETO_FINAL_ENVIADO | PROJETO_APROVADO) casados por construtora+obra.
// Não cria/deleta projeto, não altera status, não dispara e-mail.
export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser();
    const { csv } = await req.json();
    const report = await commitFinalProjectsImport(actor, csv ?? "");
    return ok(report);
  } catch (e) {
    return fail(e);
  }
}
