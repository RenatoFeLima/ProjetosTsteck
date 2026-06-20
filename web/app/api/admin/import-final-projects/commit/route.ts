import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { requireSameOrigin } from "@/server/auth/csrf";
import { commitFinalProjectsBatch } from "@/server/services/finalProjectsImportService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/admin/import-final-projects/commit  (application/json)
// Body: { csv: string, offset?: number, chunkSize?: number }
// Apenas ADMIN. Processa UM lote do plano de enriquecimento e devolve o próximo
// offset. O backup obrigatório é gerado no primeiro lote (offset 0) antes de
// qualquer escrita. Não cria/deleta projeto, não altera status, não envia e-mail.
export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const actor = await requireUser();
    const { csv, offset, chunkSize } = await req.json();
    const result = await commitFinalProjectsBatch(
      actor,
      csv ?? "",
      Number(offset) || 0,
      Number(chunkSize) || 50,
    );
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
