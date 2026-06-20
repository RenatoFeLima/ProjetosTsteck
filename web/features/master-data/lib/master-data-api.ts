// Cliente HTTP dos Cadastros Mestres — fala com /api/master-data/* (MySQL).
import type { MasterEntityKey } from "./master-entity-keys";
import { apiRequest as request } from "@/lib/api-client";

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
