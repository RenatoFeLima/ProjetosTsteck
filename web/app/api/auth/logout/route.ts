import { type NextRequest } from "next/server";
import { getSession, clearSessionCookie } from "@/server/auth/session";
import { requireSameOrigin } from "@/server/auth/csrf";
import { writeAudit } from "@/server/services/auditService";
import { ok, fail } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const user = await getSession();
    if (user) {
      await writeAudit({
        action: "LOGOUT",
        actorUserId: user.id,
        actorName: user.name,
        message: `${user.name} realizou logout.`,
      });
    }
    await clearSessionCookie();
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
