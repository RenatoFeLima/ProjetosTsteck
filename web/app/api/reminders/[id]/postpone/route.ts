import type { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { requireSameOrigin } from "@/server/auth/csrf";
import { postponeReminder } from "@/server/services/reminderService";
import { ok, fail } from "@/server/http";
import { startTimer, logPerf } from "@/server/perf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// body: { date: "yyyy-MM-dd" } — adia o lembrete; log registra quem adiou.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const stop = startTimer();
  try {
    requireSameOrigin(req);
    const actor = await requireUser();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { date?: unknown };
    const reminder = await postponeReminder(actor, id, body.date);
    logPerf("POST /api/reminders/[id]/postpone", stop(), { success: true });
    return ok({ reminder });
  } catch (e) {
    logPerf("POST /api/reminders/[id]/postpone", stop(), { success: false });
    return fail(e);
  }
}
