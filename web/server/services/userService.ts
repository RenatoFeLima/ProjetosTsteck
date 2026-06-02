// Serviço de usuários — toda regra de RBAC e integridade roda no servidor.
// Espelha (e endurece) a lógica que já existia no store client-side.

import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/features/auth/lib/password-utils";
import { FULL_PERMISSIONS, getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { UserPermissions, UserRole } from "@/features/auth/lib/auth-types";
import { assertPermission, HttpError } from "@/server/auth/guards";
import { toSessionUser, type SessionUser } from "@/server/auth/session";
import { writeAudit } from "./auditService";

export type CreateUserInput = {
  username: string;
  name: string;
  email?: string | null;
  password: string;
  role: UserRole;
  active: boolean;
  mustChangePassword: boolean;
  permissions?: UserPermissions;
};

export type UpdateUserPatch = {
  name?: string;
  email?: string | null;
  role?: UserRole;
  active?: boolean;
  mustChangePassword?: boolean;
  permissions?: UserPermissions;
};

function countActiveAdmins(): Promise<number> {
  return prisma.user.count({ where: { role: "ADMIN", active: true } });
}

async function getOrThrow(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, "Usuário não encontrado.");
  return user;
}

export async function listUsers(actor: SessionUser): Promise<SessionUser[]> {
  assertPermission(actor, (p) => p.users.view);
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  return users.map(toSessionUser);
}

export async function createUser(actor: SessionUser, input: CreateUserInput): Promise<SessionUser> {
  assertPermission(actor, (p) => p.users.create);

  const username = input.username.trim();
  const email = input.email?.trim() || null;
  if (!username || !input.name.trim()) throw new HttpError(400, "Nome e usuário são obrigatórios.");
  if (!input.password || input.password.length < 6) {
    throw new HttpError(400, "A senha deve ter pelo menos 6 caracteres.");
  }

  if (await prisma.user.findUnique({ where: { username } })) {
    throw new HttpError(409, "Nome de usuário já está em uso.");
  }
  if (email && (await prisma.user.findUnique({ where: { email } }))) {
    throw new HttpError(409, "E-mail já está cadastrado.");
  }

  const passwordHash = await hashPassword(input.password);
  const created = await prisma.user.create({
    data: {
      username,
      name: input.name.trim(),
      email,
      passwordHash,
      role: input.role,
      active: input.active,
      mustChangePassword: input.mustChangePassword,
      permissionsJson: (input.permissions ?? getDefaultPermissions(input.role)) as object,
      createdById: actor.id,
    },
  });

  await writeAudit({
    action: "USER_CREATED",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: "user",
    entityId: created.id,
    message: `${actor.name} criou o usuário ${created.name} (${created.username}).`,
  });

  return toSessionUser(created);
}

export async function updateUser(
  actor: SessionUser,
  id: string,
  patch: UpdateUserPatch,
): Promise<SessionUser> {
  const changesPermissions = patch.permissions !== undefined;
  assertPermission(actor, (p) => p.users.edit || (changesPermissions && p.users.managePermissions));

  const target = await getOrThrow(id);

  if (patch.active === false && id === actor.id) {
    throw new HttpError(400, "Você não pode inativar a si mesmo.");
  }
  if (patch.active === false && target.role === "ADMIN" && (await countActiveAdmins()) <= 1) {
    throw new HttpError(409, "Não é possível inativar o único administrador ativo.");
  }
  if (patch.role && patch.role !== "ADMIN" && target.role === "ADMIN" && (await countActiveAdmins()) <= 1) {
    throw new HttpError(409, "Não é possível remover o único administrador ativo.");
  }

  const email = patch.email !== undefined ? (patch.email?.trim() || null) : undefined;
  if (email) {
    const clash = await prisma.user.findFirst({ where: { email, id: { not: id } } });
    if (clash) throw new HttpError(409, "E-mail já está cadastrado.");
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      name: patch.name?.trim(),
      email,
      role: patch.role,
      active: patch.active,
      mustChangePassword: patch.mustChangePassword,
      permissionsJson: patch.permissions as object | undefined,
      updatedById: actor.id,
    },
  });

  await writeAudit({
    action: "USER_UPDATED",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: "user",
    entityId: id,
    message: `${actor.name} editou os dados do usuário ${target.name}.`,
  });

  return toSessionUser(updated);
}

export async function resetPassword(
  actor: SessionUser,
  id: string,
  newPassword: string,
): Promise<void> {
  if (id !== actor.id) assertPermission(actor, (p) => p.users.resetPassword);
  if (!newPassword || newPassword.length < 6) {
    throw new HttpError(400, "A senha deve ter pelo menos 6 caracteres.");
  }
  const target = await getOrThrow(id);
  const passwordHash = await hashPassword(newPassword);
  const isSelf = id === actor.id;

  await prisma.user.update({
    where: { id },
    data: { passwordHash, mustChangePassword: !isSelf, updatedById: actor.id },
  });

  await writeAudit({
    action: isSelf ? "PASSWORD_SELF_CHANGED" : "PASSWORD_RESET",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: "user",
    entityId: id,
    message: isSelf
      ? `${actor.name} alterou a própria senha.`
      : `${actor.name} redefiniu a senha do usuário ${target.name}.`,
  });
}

export async function setActive(
  actor: SessionUser,
  id: string,
  active: boolean,
): Promise<SessionUser> {
  assertPermission(actor, (p) => p.users.delete);
  if (!active && id === actor.id) throw new HttpError(400, "Você não pode inativar a si mesmo.");

  const target = await getOrThrow(id);
  if (!active && target.role === "ADMIN" && (await countActiveAdmins()) <= 1) {
    throw new HttpError(409, "Não é possível inativar o único administrador ativo.");
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { active, updatedById: actor.id },
  });

  await writeAudit({
    action: active ? "USER_ACTIVATED" : "USER_INACTIVATED",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: "user",
    entityId: id,
    message: `${actor.name} ${active ? "ativou" : "inativou"} o usuário ${target.name}.`,
  });

  return toSessionUser(updated);
}

export async function promoteToAdmin(actor: SessionUser, id: string): Promise<SessionUser> {
  assertPermission(actor, (p) => p.users.promoteAdmin);
  const target = await getOrThrow(id);

  const updated = await prisma.user.update({
    where: { id },
    data: { role: "ADMIN", permissionsJson: FULL_PERMISSIONS as object, updatedById: actor.id },
  });

  await writeAudit({
    action: "USER_PROMOTED_ADMIN",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: "user",
    entityId: id,
    message: `${actor.name} promoveu ${target.name} para Administrador.`,
  });

  return toSessionUser(updated);
}

export async function revokeAdmin(actor: SessionUser, id: string): Promise<SessionUser> {
  assertPermission(actor, (p) => p.users.promoteAdmin);
  if ((await countActiveAdmins()) <= 1) {
    throw new HttpError(409, "Não é possível remover o único administrador ativo.");
  }
  const target = await getOrThrow(id);

  const updated = await prisma.user.update({
    where: { id },
    data: {
      role: "VIEWER",
      permissionsJson: getDefaultPermissions("VIEWER") as object,
      updatedById: actor.id,
    },
  });

  await writeAudit({
    action: "USER_REVOKED_ADMIN",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: "user",
    entityId: id,
    message: `${actor.name} removeu o perfil de administrador de ${target.name}.`,
  });

  return toSessionUser(updated);
}
