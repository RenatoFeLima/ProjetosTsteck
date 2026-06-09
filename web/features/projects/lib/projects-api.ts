// Cliente HTTP de Projetos — /api/projects/* (MySQL via Prisma).
// A API serializa no formato da UI (Project), então o consumo é direto.
import type { Project, StatusHistoryItem, ProjectObservation } from "@/features/projects/domain/project-types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data as { error?: string; message?: string };
    throw new Error(d.message ?? d.error ?? "Erro na requisição.");
  }
  return data as T;
}

export async function apiListProjects(): Promise<Project[]> {
  const data = await request<{ projects: Project[] }>("/api/projects");
  return data.projects;
}

export async function apiCreateProject(input: Partial<Project>): Promise<Project> {
  const data = await request<{ project: Project }>("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.project;
}

export async function apiUpdateProject(id: string, patch: Partial<Project>): Promise<Project> {
  const data = await request<{ project: Project }>(`/api/projects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return data.project;
}

export async function apiChangeStatus(
  id: string,
  status: string,
  opts: { reason?: string; source?: string; note?: string } = {},
): Promise<Project> {
  const data = await request<{ project: Project }>(`/api/projects/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ status, ...opts }),
  });
  return data.project;
}

export async function apiSetUrgency(id: string, urgent: boolean, reason?: string): Promise<Project> {
  const data = await request<{ project: Project }>(`/api/projects/${id}/urgency`, {
    method: urgent ? "POST" : "DELETE",
    body: JSON.stringify({ reason }),
  });
  return data.project;
}

export async function apiAddObservation(id: string, text: string): Promise<void> {
  await request(`/api/projects/${id}/observations`, { method: "POST", body: JSON.stringify({ text }) });
}

export type ProjectHistoryResponse = {
  statusHistory: StatusHistoryItem[];
  observations: ProjectObservation[];
  reviewStudyHistory: { id: string; enteredAt: string; exitedAt: string | null; reason: string; changedBy: string }[];
  finalReviewHistory: { id: string; enteredAt: string; exitedAt: string | null; reason: string; changedBy: string }[];
};

export async function apiGetHistory(id: string): Promise<ProjectHistoryResponse> {
  return request<ProjectHistoryResponse>(`/api/projects/${id}/history`);
}

/** Item agregado de revisão (estudo/final) — base dos SLAs de revisão. */
export type ReviewAggItem = { projectId: string; enteredAt: string; exitedAt: string | null };

export type AnalyticsBundle = {
  statusHistory: StatusHistoryItem[];
  reviewStudy: ReviewAggItem[];
  finalReview: ReviewAggItem[];
};

/** Dados agregados de TODOS os projetos (KPIs de tempo + SLAs de revisão). */
export async function apiGetAnalytics(): Promise<AnalyticsBundle> {
  return request<AnalyticsBundle>("/api/projects/analytics");
}
