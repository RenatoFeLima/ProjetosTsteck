import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { commitProjectsExcelBatch } from "@/server/services/projectsExcelImportService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/projects/import/commit  (application/json)
// Body: { csv: string, offset?: number, chunkSize?: number }
// Apenas ADMIN. Processa UM lote do plano e devolve o próximo offset. Backup
// obrigatório no primeiro lote (offset 0). Atualiza apenas projetos existentes;
// não cria/deleta projeto, não altera status, não envia e-mail.
export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser();
    const { csv, offset, chunkSize } = await req.json();
    const result = await commitProjectsExcelBatch(actor, csv ?? "", Number(offset) || 0, Number(chunkSize) || 50);
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
