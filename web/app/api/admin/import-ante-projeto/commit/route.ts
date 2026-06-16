import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { commitAnteProjetoImport } from "@/server/services/anteProjetoImportService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/admin/import-ante-projeto/commit  (application/json)
// Body: { csv: string } — texto do CSV de Ante-Projeto.
// Apenas ADMIN. Executa em transação:
//   1. Deleta projetos em ELABORAR_ANTE_PROJETO | ANTE_PROJETO_ENVIADO | ANTE_PROJETO_APROVADO.
//   2. Cria os projetos do CSV como nova fonte oficial.
// Sem e-mail, sem notificação.
export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser();
    const { csv } = await req.json();
    const report = await commitAnteProjetoImport(actor, csv ?? "");
    return ok(report);
  } catch (e) {
    return fail(e);
  }
}
