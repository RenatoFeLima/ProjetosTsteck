import { requireUser } from "@/server/auth/guards";
import { listReminders } from "@/server/services/reminderService";
import { ok, fail } from "@/server/http";
import { startTimer, logPerf } from "@/server/perf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lista os lembretes visíveis ao usuário (escopo por vendedor para SELLER). */
export async function GET() {
  const stop = startTimer();
  try {
    const actor = await requireUser();
    const reminders = await listReminders(actor);
    logPerf("GET /api/reminders", stop(), { success: true });
    return ok({ reminders });
  } catch (e) {
    logPerf("GET /api/reminders", stop(), { success: false });
    return fail(e);
  }
}
