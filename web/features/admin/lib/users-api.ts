// Cliente HTTP do módulo de Usuários — fala com /api/users/* (MySQL via Prisma).
// Toda mutação é validada no servidor (RBAC). Aqui só fazemos fetch e mapeamos.

import type { User, UserPermissions, UserRole } from "@/features/auth/lib/auth-types";
import { mapApiUser, type ApiUser } from "@/features/auth/lib/api-user";
import { apiRequest as request } from "@/lib/api-client";

export async function fetchUsers(): Promise<User[]> {
  const data = await request<{ users: ApiUser[] }>("/api/users");
  return data.users.map(mapApiUser);
}

export type CreateUserPayload = {
  username: string;
  name: string;
  email?: string;
  password: string;
  role: UserRole;
  active: boolean;
  mustChangePassword: boolean;
  permissions?: UserPermissions;
  sellerId?: string | null;
};

export async function createUser(payload: CreateUserPayload): Promise<User> {
  const data = await request<{ user: ApiUser }>("/api/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return mapApiUser(data.user);
}

export type UpdateUserPayload = {
  name?: string;
  email?: string | null;
  role?: UserRole;
  active?: boolean;
  mustChangePassword?: boolean;
  permissions?: UserPermissions;
  sellerId?: string | null;
};

export async function updateUser(id: string, patch: UpdateUserPayload): Promise<User> {
  const data = await request<{ user: ApiUser }>(`/api/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return mapApiUser(data.user);
}

export async function resetPassword(id: string, newPassword: string): Promise<void> {
  await request(`/api/users/${id}/password`, {
    method: "POST",
    body: JSON.stringify({ newPassword }),
  });
}

export async function setActive(id: string, active: boolean): Promise<User> {
  const data = await request<{ user: ApiUser }>(`/api/users/${id}/active`, {
    method: "POST",
    body: JSON.stringify({ active }),
  });
  return mapApiUser(data.user);
}

export async function setRole(id: string, action: "promote" | "revoke"): Promise<User> {
  const data = await request<{ user: ApiUser }>(`/api/users/${id}/role`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
  return mapApiUser(data.user);
}
