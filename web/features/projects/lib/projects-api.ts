// Cliente HTTP de Projetos — /api/projects/* (MySQL via Prisma).
// A API serializa no formato da UI (Project), então o consumo é direto.
import type { Project, StatusHistoryItem, ProjectObservation } from "@/features/projects/domain/project-types";
import { apiRequest as request, apiFetch } from "@/lib/api-client";

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
  opts: { reason?: string; source?: string; note?: string; finalCode?: string } = {},
): Promise<Project> {
  const data = await request<{ project: Project }>(`/api/projects/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ status, ...opts }),
  });
  return data.project;
}

export type NextCodeSuggestion = {
  maxSuffix: number;
  nextSuffix: string;
  /** Código do último projeto que chegou em PROJETO APROVADO / terminal (referência "De:"). */
  lastFinalCode: string | null;
  /** Código provisório do projeto sendo movimentado. */
  currentDraftCode: string | null;
  /** Sugestão do código final (editável). */
  suggestedFinalCode: string | null;
};

/** Sugestão do código final, baseada no último projeto finalizado. `currentCode`
 *  é o código provisório do projeto sendo movimentado (fallback/secundário). */
export async function apiGetNextCodeSuggestion(currentCode?: string): Promise<NextCodeSuggestion> {
  const qs = currentCode ? `?currentCode=${encodeURIComponent(currentCode)}` : "";
  return request<NextCodeSuggestion>(`/api/projects/next-code-suggestion${qs}`);
}

export async function apiSetUrgency(id: string, urgent: boolean, reason?: string, deadline?: string): Promise<Project> {
  const data = await request<{ project: Project }>(`/api/projects/${id}/urgency`, {
    method: urgent ? "POST" : "DELETE",
    body: JSON.stringify({ reason, deadline }),
  });
  return data.project;
}

/** Baixa o CSV de TODOS os projetos. Dispara o download no navegador. */
export async function apiExportProjects(): Promise<void> {
  const res = await apiFetch("/api/projects/export", { method: "GET" });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(data.message ?? data.error ?? "Falha ao exportar projetos.");
  }
  // Nome do arquivo vem do Content-Disposition; fallback com timestamp.
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const fileName = match?.[1] ?? `projetos-tsteck-${new Date().toISOString().slice(0, 10)}.csv`;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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
