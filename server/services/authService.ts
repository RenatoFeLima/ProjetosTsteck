// Serviço de autenticação — usa Prisma. Valida senha (PBKDF2, mesmo hash do app),
// bloqueia usuário inativo, registra auditoria de login/falha.

import { prisma } from "@/lib/db/prisma";
import { verifyPassword, hashPassword } from "@/features/auth/lib/password-utils";
import { toSessionUser, type SessionUser } from "@/server/auth/session";
import { writeAudit } from "./auditService";

export type LoginResult =
  | { ok: true; user: SessionUser; mustChangePassword: boolean }
  | { ok: false; error: string };

export async function login(username: string, password: string): Promise<LoginResult> {
  const uname = username.trim();
  const user = await prisma.user.findUnique({ where: { username: uname } });

  if (!user || !user.active) {
    await writeAudit({
      action: "LOGIN_FAILED",
      actorUserId: user?.id ?? null,
      actorName: user?.name ?? null,
      message: `Tentativa de login com usuário "${uname}" — não encontrado ou inativo.`,
    });
    return { ok: false, error: "Usuário ou senha inválidos." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await writeAudit({
      action: "LOGIN_FAILED",
      actorUserId: user.id,
      actorName: user.name,
      message: `Login negado para ${user.name} — senha incorreta.`,
    });
    return { ok: false, error: "Usuário ou senha inválidos." };
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await writeAudit({
    action: "LOGIN",
    actorUserId: user.id,
    actorName: user.name,
    message: `${user.name} realizou login.`,
  });

  return { ok: true, user: toSessionUser(updated), mustChangePassword: updated.mustChangePassword };
}

/** Troca a própria senha (limpa mustChangePassword). */
export async function changeOwnPassword(
  userId: string,
  actorName: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: "A senha deve ter pelo menos 6 caracteres." };
  }
  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });
  await writeAudit({
    action: "PASSWORD_SELF_CHANGED",
    actorUserId: userId,
    actorName,
    entityType: "user",
    entityId: userId,
    message: `${actorName} alterou a própria senha.`,
  });
  return { ok: true };
}
