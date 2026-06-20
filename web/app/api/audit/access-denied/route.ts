import { type NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { requireSameOrigin } from "@/server/auth/csrf";
import { writeAudit } from "@/server/services/auditService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Registra tentativa de acesso a área sem permissão (chamado pelo layout protegido).
export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { area?: string; path?: string };
    await writeAudit({
      action: "ACCESS_DENIED",
      actorUserId: user.id,
      actorName: user.name,
      message: `Tentativa de acesso sem permissão: ${body.area ?? "área"} (${body.path ?? "?"}).`,
    });
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
