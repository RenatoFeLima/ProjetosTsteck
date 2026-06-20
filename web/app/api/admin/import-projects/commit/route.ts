import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { requireSameOrigin } from "@/server/auth/csrf";
import { commitImport } from "@/server/services/importService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/admin/import-projects/commit  (application/json)
// Body: { cadastroCsv?: string; anteCsv?: string } — ao menos um.
// Apenas ADMIN. Grava Obras e Projetos em lote. NÃO dispara e-mail/notificação.
export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const actor = await requireUser();
    const { cadastroCsv, anteCsv } = await req.json();
    const report = await commitImport(actor, { cadastroCsv, anteCsv });
    return ok(report);
  } catch (e) {
    return fail(e);
  }
}
