// Tipo do usuário como retornado pela API (/api/auth/me, /api/users) — sem hash.
// Mapper para o tipo `User` usado pela UI (preenche campos não expostos pela API).

import type { User, UserPermissions, UserRole } from "./auth-types";

export type ApiUser = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: UserRole;
  active: boolean;
  mustChangePassword: boolean;
  permissions: UserPermissions;
  lastLoginAt: string | null;
};

export function mapApiUser(u: ApiUser): User {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email ?? undefined,
    passwordHash: "", // nunca exposto ao client
    role: u.role,
    active: u.active,
    mustChangePassword: u.mustChangePassword,
    permissions: u.permissions,
    createdAt: "",
    updatedAt: "",
    lastLoginAt: u.lastLoginAt ?? undefined,
  };
}
