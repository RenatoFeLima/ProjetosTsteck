// Cliente HTTP de Lembretes Operacionais — /api/reminders/* e
// /api/projects/[id]/reminders. A API serializa no formato da UI.
import type { ProjectReminder } from "@/features/projects/domain/project-reminders";
import { apiRequest as request } from "@/lib/api-client";

export async function apiListReminders(): Promise<ProjectReminder[]> {
  const data = await request<{ reminders: ProjectReminder[] }>("/api/reminders");
  return data.reminders;
}

export type ReminderCreatePayload = {
  descricao: string;
  prioridade: "NORMAL" | "ALTA";
  data_inicial: string;
  recorrencia_dias: number;
};

export async function apiCreateReminder(projectId: string, input: ReminderCreatePayload): Promise<ProjectReminder> {
  const data = await request<{ reminder: ProjectReminder }>(`/api/projects/${projectId}/reminders`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.reminder;
}

export async function apiUpdateReminder(
  id: string,
  patch: Partial<ReminderCreatePayload> & { proxima_data?: string },
): Promise<ProjectReminder> {
  const data = await request<{ reminder: ProjectReminder }>(`/api/reminders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return data.reminder;
}

export async function apiPostponeReminder(id: string, date: string): Promise<ProjectReminder> {
  const data = await request<{ reminder: ProjectReminder }>(`/api/reminders/${id}/postpone`, {
    method: "POST",
    body: JSON.stringify({ date }),
  });
  return data.reminder;
}

export async function apiResolveReminder(id: string): Promise<ProjectReminder> {
  const data = await request<{ reminder: ProjectReminder }>(`/api/reminders/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return data.reminder;
}

/** Remove o lembrete (soft delete no backend — encerra os alertas recorrentes). */
export async function apiRemoveReminder(id: string): Promise<ProjectReminder> {
  const data = await request<{ reminder: ProjectReminder }>(`/api/reminders/${id}`, { method: "DELETE" });
  return data.reminder;
}
