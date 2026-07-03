import type { NextRequest } from "next/server";
import { requireUser } from "@/server/auth/guards";
import { requireSameOrigin } from "@/server/auth/csrf";
import { updateReminder, cancelReminder } from "@/server/services/reminderService";
import { ok, fail } from "@/server/http";
import { startTimer, logPerf } from "@/server/perf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// body: { descricao?, prioridade?, proxima_data?, recorrencia_dias? }
// Somente ADMIN/PROJECTS (validado no service — defesa em profundidade).
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const stop = startTimer();
  try {
    requireSameOrigin(req);
    const actor = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const reminder = await updateReminder(actor, id, body);
    logPerf("PATCH /api/reminders/[id]", stop(), { success: true });
    return ok({ reminder });
  } catch (e) {
    logPerf("PATCH /api/reminders/[id]", stop(), { success: false });
    return fail(e);
  }
}

// Remove o lembrete (soft delete: status CANCELADO, mantém auditoria).
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const stop = startTimer();
  try {
    requireSameOrigin(req);
    const actor = await requireUser();
    const { id } = await ctx.params;
    const reminder = await cancelReminder(actor, id);
    logPerf("DELETE /api/reminders/[id]", stop(), { success: true });
    return ok({ reminder });
  } catch (e) {
    logPerf("DELETE /api/reminders/[id]", stop(), { success: false });
    return fail(e);
  }
}
