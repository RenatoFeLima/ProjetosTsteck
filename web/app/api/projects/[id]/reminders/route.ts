import type { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { requireSameOrigin } from "@/server/auth/csrf";
import { createReminder } from "@/server/services/reminderService";
import { ok, fail } from "@/server/http";
import { startTimer, logPerf } from "@/server/perf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// body: { descricao, prioridade, data_inicial, recorrencia_dias }
// Somente ADMIN/PROJECTS (validado no service — defesa em profundidade).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const stop = startTimer();
  try {
    requireSameOrigin(req);
    const actor = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const reminder = await createReminder(actor, id, body);
    logPerf("POST /api/projects/[id]/reminders", stop(), { success: true });
    return ok({ reminder }, 201);
  } catch (e) {
    logPerf("POST /api/projects/[id]/reminders", stop(), { success: false });
    return fail(e);
  }
}
