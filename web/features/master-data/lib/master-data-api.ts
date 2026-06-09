// Cliente HTTP dos Cadastros Mestres — fala com /api/master-data/* (MySQL).
import type { MasterEntityKey } from "./master-entity-keys";

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

export async function listEntity<T>(entity: MasterEntityKey, includeInactive = false): Promise<T[]> {
  const qs = includeInactive ? "?includeInactive=true" : "";
  const data = await request<{ items: T[] }>(`/api/master-data/${entity}${qs}`);
  return data.items;
}

export async function createEntity<T>(entity: MasterEntityKey, payload: Record<string, unknown>): Promise<T> {
  const data = await request<{ item: T }>(`/api/master-data/${entity}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.item;
}

export async function updateEntity<T>(
  entity: MasterEntityKey,
  id: string,
  patch: Record<string, unknown>,
): Promise<T> {
  const data = await request<{ item: T }>(`/api/master-data/${entity}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return data.item;
}

export async function setEntityActive<T>(entity: MasterEntityKey, id: string, active: boolean): Promise<T> {
  const data = await request<{ item: T }>(`/api/master-data/${entity}/${id}/active`, {
    method: "POST",
    body: JSON.stringify({ active }),
  });
  return data.item;
}
