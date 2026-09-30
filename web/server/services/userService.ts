// Serviço de usuários — toda regra de RBAC e integridade roda no servidor.
// Espelha (e endurece) a lógica que já existia no store client-side.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/features/auth/lib/password-utils";
import { FULL_PERMISSIONS, getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { UserPermissions, UserRole } from "@/features/auth/lib/auth-types";
import { assertPermission, HttpError } from "@/server/auth/guards";
import { toSessionUser, USER_SELLER_LINKS, type SessionUser } from "@/server/auth/session";
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
  /** Vendedores vinculados (perfil Vendedor exige pelo menos um). */
  sellerIds?: string[];
};

export type UpdateUserPatch = {
  name?: string;
  email?: string | null;
  role?: UserRole;
  active?: boolean;
  mustChangePassword?: boolean;
  permissions?: UserPermissions;
  /** Conjunto COMPLETO de vendedores vinculados (substitui o atual). Ausente = mantém. */
  sellerIds?: string[];
};

// ─── Vínculo com vendedores (UserSeller) ─────────────────────────────────────
//
// UserSeller é a única fonte de verdade. `User.sellerId` (legado) é só um
// espelho de compatibilidade da Release 1 — atualizado na MESMA transação para
// que um rollback de código continue vendo um vendedor que o usuário de fato
// tem (nunca um que já foi removido).

export const LEGACY_SELLER_FIELD_MESSAGE =
  "Esta tela está desatualizada. Recarregue a página e tente novamente.";
const SELLER_REQUIRED_MESSAGE = "Selecione pelo menos um vendedor para o perfil Vendedor.";

type SellerRef = { id: string; name: string };

/** O contrato antigo (`sellerId` único) é recusado: convertê-lo em [sellerId]
 *  substituiria o conjunto inteiro e apagaria os demais vínculos em silêncio. */
function rejectLegacySellerField(body: unknown): void {
  if (body && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, "sellerId")) {
    throw new HttpError(400, LEGACY_SELLER_FIELD_MESSAGE);
  }
}

/** Lista de IDs vinda do cliente: só strings não vazias, sem duplicados. Ausente → undefined. */
function normalizeSellerIds(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.some((v) => typeof v !== "string" || !v.trim())) {
    throw new HttpError(400, "Lista de vendedores inválida.");
  }
  return [...new Set(raw.map((v: string) => v.trim()))];
}

/**
 * Espelho legado determinístico: mantém o vendedor atual se ele continua no
 * conjunto; senão, o de MENOR id (ordem lexicográfica) do conjunto; sem
 * vínculos → null. Qualquer escolha dentro do conjunto é segura para rollback.
 */
export function legacySellerMirror(current: string | null, sellerIds: readonly string[]): string | null {
  if (sellerIds.length === 0) return null;
  if (current && sellerIds.includes(current)) return current;
  return [...sellerIds].sort()[0];
}

/** Não é um segundo perfil de permissão: o SELLER nunca altera usuários, nem os
 *  próprios vendedores — mesmo que o permissionsJson persistido diga o contrário. */
function assertNotSeller(actor: SessionUser): void {
  if (actor.role === "SELLER") throw new HttpError(403, "Seu perfil não pode alterar usuários.");
}

/**
 * Valida o conjunto final e devolve nome de todos os envolvidos (atuais + novos):
 *  - todo vendedor pedido precisa existir;
 *  - vendedor inativo só pode CONTINUAR vinculado (nunca ser vinculado de novo).
 */
async function loadSellersForLink(
  tx: Prisma.TransactionClient,
  nextIds: readonly string[],
  currentIds: readonly string[],
): Promise<Map<string, SellerRef & { active: boolean }>> {
  const ids = [...new Set([...nextIds, ...currentIds])];
  if (ids.length === 0) return new Map();
  const rows = await tx.seller.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, active: true } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  if (nextIds.some((id) => !byId.has(id))) throw new HttpError(400, "Vendedor vinculado não encontrado.");
  const newInactive = nextIds.filter((id) => !byId.get(id)!.active && !currentIds.includes(id));
  if (newInactive.length > 0) {
    const names = newInactive.map((id) => byId.get(id)!.name).join(", ");
    throw new HttpError(400, `Vendedor inativo não pode ser vinculado: ${names}.`);
  }
  return byId;
}

/** Diferença auditável (IDs e nomes) entre o conjunto anterior e o novo. */
function sellersAuditDiff(
  before: readonly string[],
  after: readonly string[],
  byId: Map<string, SellerRef>,
): Prisma.InputJsonObject {
  const ref = (id: string): SellerRef => ({ id, name: byId.get(id)?.name ?? id });
  return {
    before: before.map(ref),
    after: after.map(ref),
    added: after.filter((id) => !before.includes(id)).map(ref),
    removed: before.filter((id) => !after.includes(id)).map(ref),
  };
}

/** Remove todos os vínculos (troca de perfil saindo de SELLER). Devolve os removidos com nome. */
async function clearSellerLinks(tx: Prisma.TransactionClient, userId: string): Promise<Prisma.InputJsonObject | null> {
  const current = (await tx.userSeller.findMany({ where: { userId }, select: { sellerId: true } })).map((l) => l.sellerId);
  if (current.length === 0) return null;
  const byId = await loadSellersForLink(tx, [], current);
  await tx.userSeller.deleteMany({ where: { userId } });
  return sellersAuditDiff(current, [], byId);
}

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
  // Vínculos carregados junto (include) — sem uma consulta por usuário.
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: USER_SELLER_LINKS });
  return users.map(toSessionUser);
}

export async function createUser(actor: SessionUser, input: CreateUserInput): Promise<SessionUser> {
  assertPermission(actor, (p) => p.users.create);
  assertNotSeller(actor);
  rejectLegacySellerField(input);

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

  // Vínculo com vendedores só existe no perfil Vendedor — e nele é obrigatório.
  const requested = normalizeSellerIds(input.sellerIds) ?? [];
  const sellerIds = input.role === "SELLER" ? requested : [];
  if (input.role === "SELLER" && sellerIds.length === 0) throw new HttpError(400, SELLER_REQUIRED_MESSAGE);

  const passwordHash = await hashPassword(input.password);

  // Usuário + vínculos + espelho legado + auditoria: tudo ou nada.
  const created = await prisma.$transaction(async (tx) => {
    const byId = await loadSellersForLink(tx, sellerIds, []);
    const user = await tx.user.create({
      data: {
        username,
        name: input.name.trim(),
        email,
        passwordHash,
        role: input.role,
        active: input.active,
        mustChangePassword: input.mustChangePassword,
        permissionsJson: (input.permissions ?? getDefaultPermissions(input.role)) as unknown as Prisma.InputJsonValue,
        sellerId: legacySellerMirror(null, sellerIds),
        createdById: actor.id,
        sellerLinks: { create: sellerIds.map((sellerId) => ({ sellerId })) },
      },
      include: USER_SELLER_LINKS,
    });
    await tx.auditLog.create({
      data: {
        action: "USER_CREATED",
        actorUserId: actor.id,
        actorName: actor.name,
        entityType: "user",
        entityId: user.id,
        message: `${actor.name} criou o usuário ${user.name} (${user.username}).`,
        metadataJson: sellerIds.length > 0 ? { sellers: sellersAuditDiff([], sellerIds, byId) } : undefined,
      },
    });
    return user;
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
  assertNotSeller(actor);
  rejectLegacySellerField(patch);
  const requested = normalizeSellerIds(patch.sellerIds);

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

  // O papel resultante decide os vínculos: fora do perfil Vendedor, todos são
  // removidos (sem vínculos "adormecidos" para uma volta futura); no perfil
  // Vendedor, o conjunto enviado substitui o atual (ausente = mantém) e nunca
  // pode ficar vazio — inclusive para um SELLER antigo ainda sem vendedor.
  const resultingRole = (patch.role ?? target.role) as UserRole;

  const updated = await prisma.$transaction(async (tx) => {
    const currentIds = (await tx.userSeller.findMany({ where: { userId: id }, select: { sellerId: true } })).map((l) => l.sellerId);
    const nextIds = resultingRole === "SELLER" ? (requested ?? currentIds) : [];
    if (resultingRole === "SELLER" && nextIds.length === 0) throw new HttpError(400, SELLER_REQUIRED_MESSAGE);

    const byId = await loadSellersForLink(tx, nextIds, currentIds);
    const added = nextIds.filter((sid) => !currentIds.includes(sid));
    const removed = currentIds.filter((sid) => !nextIds.includes(sid));
    if (removed.length > 0) await tx.userSeller.deleteMany({ where: { userId: id, sellerId: { in: removed } } });
    if (added.length > 0) {
      await tx.userSeller.createMany({ data: added.map((sellerId) => ({ userId: id, sellerId })), skipDuplicates: true });
    }

    const user = await tx.user.update({
      where: { id },
      data: {
        name: patch.name?.trim(),
        email,
        role: patch.role,
        active: patch.active,
        mustChangePassword: patch.mustChangePassword,
        permissionsJson: patch.permissions as unknown as Prisma.InputJsonValue | undefined,
        sellerId: resultingRole === "SELLER" ? legacySellerMirror(target.sellerId, nextIds) : null,
        updatedById: actor.id,
      },
      include: USER_SELLER_LINKS,
    });

    await tx.auditLog.create({
      data: {
        action: "USER_UPDATED",
        actorUserId: actor.id,
        actorName: actor.name,
        entityType: "user",
        entityId: id,
        message: `${actor.name} editou os dados do usuário ${target.name}.`,
        metadataJson:
          added.length > 0 || removed.length > 0 ? { sellers: sellersAuditDiff(currentIds, nextIds, byId) } : undefined,
      },
    });
    return user;
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
  assertNotSeller(actor);
  if (!active && id === actor.id) throw new HttpError(400, "Você não pode inativar a si mesmo.");

  const target = await getOrThrow(id);
  if (!active && target.role === "ADMIN" && (await countActiveAdmins()) <= 1) {
    throw new HttpError(409, "Não é possível inativar o único administrador ativo.");
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { active, updatedById: actor.id },
    include: USER_SELLER_LINKS,
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
  assertNotSeller(actor);
  const target = await getOrThrow(id);

  // Troca de perfil: sai de SELLER (se era) → vínculos removidos, na mesma transação.
  const updated = await prisma.$transaction(async (tx) => {
    const removedSellers = await clearSellerLinks(tx, id);
    const user = await tx.user.update({
      where: { id },
      data: { role: "ADMIN", permissionsJson: FULL_PERMISSIONS as unknown as Prisma.InputJsonValue, sellerId: null, updatedById: actor.id },
      include: USER_SELLER_LINKS,
    });
    await tx.auditLog.create({
      data: {
        action: "USER_PROMOTED_ADMIN",
        actorUserId: actor.id,
        actorName: actor.name,
        entityType: "user",
        entityId: id,
        message: `${actor.name} promoveu ${target.name} para Administrador.`,
        metadataJson: removedSellers ? { sellers: removedSellers } : undefined,
      },
    });
    return user;
  });

  return toSessionUser(updated);
}

export async function revokeAdmin(actor: SessionUser, id: string): Promise<SessionUser> {
  assertPermission(actor, (p) => p.users.promoteAdmin);
  assertNotSeller(actor);
  if ((await countActiveAdmins()) <= 1) {
    throw new HttpError(409, "Não é possível remover o único administrador ativo.");
  }
  const target = await getOrThrow(id);

  const updated = await prisma.$transaction(async (tx) => {
    const removedSellers = await clearSellerLinks(tx, id);
    const user = await tx.user.update({
      where: { id },
      data: {
        role: "VIEWER",
        permissionsJson: getDefaultPermissions("VIEWER") as unknown as Prisma.InputJsonValue,
        sellerId: null,
        updatedById: actor.id,
      },
      include: USER_SELLER_LINKS,
    });
    await tx.auditLog.create({
      data: {
        action: "USER_REVOKED_ADMIN",
        actorUserId: actor.id,
        actorName: actor.name,
        entityType: "user",
        entityId: id,
        message: `${actor.name} removeu o perfil de administrador de ${target.name}.`,
        metadataJson: removedSellers ? { sellers: removedSellers } : undefined,
      },
    });
    return user;
  });

  return toSessionUser(updated);
}
