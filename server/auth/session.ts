// Sessão server-side: cookie HTTP-only + JWT.
// getSession() relê o usuário do banco a cada chamada, garantindo que usuário
// inativado/alterado perca acesso imediatamente (sem confiar em dados do token).

import { cookies } from "next/headers";
import type { User as DbUser } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { signSessionToken, verifySessionToken, sessionDurationSeconds } from "@/lib/auth/jwt";
import type { UserPermissions, UserRole } from "@/features/auth/lib/auth-types";

export const SESSION_COOKIE = "tsteck_session";

export type SessionUser = {
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

/** Converte o registro do banco para o objeto de sessão (sem passwordHash). */
export function toSessionUser(u: DbUser): SessionUser {
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    email: u.email,
    role: u.role as UserRole,
    active: u.active,
    mustChangePassword: u.mustChangePassword,
    permissions: u.permissionsJson as unknown as UserPermissions,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
  };
}

export async function setSessionCookie(userId: string): Promise<void> {
  const token = await signSessionToken(userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionDurationSeconds(),
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Usuário autenticado atual, ou null. Relido do banco; bloqueia inativos. */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const userId = await verifySessionToken(token);
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) return null;

  return toSessionUser(user);
}
