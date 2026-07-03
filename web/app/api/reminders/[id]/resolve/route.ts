import type { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { requireSameOrigin } from "@/server/auth/csrf";
import { resolveReminder } from "@/server/services/reminderService";
import { ok, fail } from "@/server/http";
import { startTimer, logPerf } from "@/server/perf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Marca o lembrete como resolvido — encerra os alertas recorrentes.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const stop = startTimer();
  try {
    requireSameOrigin(req);
    const actor = await requireUser();
    const { id } = await ctx.params;
    const reminder = await resolveReminder(actor, id);
    logPerf("POST /api/reminders/[id]/resolve", stop(), { success: true });
    return ok({ reminder });
  } catch (e) {
    logPerf("POST /api/reminders/[id]/resolve", stop(), { success: false });
    return fail(e);
  }
}
