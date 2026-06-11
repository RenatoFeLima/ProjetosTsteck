import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { dryRunImport } from "@/server/services/importService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/admin/import-projects/dry-run  (multipart/form-data)
// Campos: cadastroInicial (File), anteProjeto (File) — ao menos um.
// Apenas ADMIN. Lê os CSVs, valida vínculos e retorna o relatório SEM gravar.
export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser();
    const form = await req.formData();
    const files = await readCsvFields(form);
    const report = await dryRunImport(actor, files);
    return ok(report);
  } catch (e) {
    return fail(e);
  }
}

async function readCsvFields(form: FormData) {
  const cadastro = form.get("cadastroInicial");
  const ante = form.get("anteProjeto");
  return {
    cadastroCsv: cadastro instanceof File ? await cadastro.text() : undefined,
    anteCsv: ante instanceof File ? await ante.text() : undefined,
  };
}
