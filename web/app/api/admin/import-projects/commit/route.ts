import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { commitImport } from "@/server/services/importService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/admin/import-projects/commit  (multipart/form-data)
// Campos: cadastroInicial (File), anteProjeto (File) — ao menos um.
// Apenas ADMIN. Grava Obras e Projetos em lote. NÃO dispara e-mail/notificação.
export async function POST(req: NextRequest) {
  try {
    const actor = await requireUser();
    const form = await req.formData();
    const cadastro = form.get("cadastroInicial");
    const ante = form.get("anteProjeto");
    const files = {
      cadastroCsv: cadastro instanceof File ? await cadastro.text() : undefined,
      anteCsv: ante instanceof File ? await ante.text() : undefined,
    };
    const report = await commitImport(actor, files);
    return ok(report);
  } catch (e) {
    return fail(e);
  }
}
