import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { dryRunImport } from "@/server/services/importService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/admin/import-projects/dry-run  (application/json)
// Body: { cadastroCsv?: string; anteCsv?: string } — ao menos um.
// Apenas ADMIN. Lê os CSVs, valida vínculos e retorna o relatório SEM gravar.
export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser();
    const { cadastroCsv, anteCsv } = await req.json();
    const report = await dryRunImport(actor, { cadastroCsv, anteCsv });
    return ok(report);
  } catch (e) {
    return fail(e);
  }
}
