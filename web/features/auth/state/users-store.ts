"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { FULL_PERMISSIONS, getDefaultPermissions } from "../lib/permissions";
import type { AuditLog, User, UserPermissions, UserRole } from "../lib/auth-types";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type CreateUserInput = {
  username: string;
  name: string;
  email?: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  mustChangePassword: boolean;
  permissions?: UserPermissions;
  createdBy: string;
};

type UsersStoreState = {
  users: User[];
  auditLogs: AuditLog[];
  seeded: boolean;
};

type UsersStoreActions = {
  /** Cria o administrador inicial (RenatoFerreira) — roda apenas uma vez. */
  seed: (adminPasswordHash: string) => void;

  getUserById: (id: string) => User | undefined;
  getUserByUsername: (username: string) => User | undefined;

  createUser: (input: CreateUserInput, actorId: string, actorName: string) => { ok: boolean; user?: User; error?: string };
  updateUser: (id: string, patch: Partial<Pick<User, "name" | "email" | "role" | "active" | "mustChangePassword" | "permissions">>, actorId: string, actorName: string) => { ok: boolean; error?: string };
  setPasswordHash: (id: string, hash: string, mustChange: boolean, actorId: string, actorName: string) => { ok: boolean };
  promoteAdmin: (id: string, actorId: string, actorName: string) => { ok: boolean; error?: string };
  revokeAdmin: (id: string, actorId: string, actorName: string) => { ok: boolean; error?: string };
  inactivateUser: (id: string, actorId: string, actorName: string) => { ok: boolean; error?: string };
  activateUser: (id: string, actorId: string, actorName: string) => { ok: boolean };
  recordLogin: (id: string) => void;

  addAuditLog: (entry: Omit<AuditLog, "id" | "createdAt">) => void;
};

type UsersStore = UsersStoreState & UsersStoreActions;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function countActiveAdmins(users: User[]): number {
  return users.filter((u) => u.role === "ADMIN" && u.active).length;
}

/**
 * Verifica, na camada de serviço, se o usuário que dispara a ação (actor)
 * realmente possui a permissão necessária. Defesa em profundidade: mesmo que a
 * UI esconda o botão, a ação não é executada sem permissão.
 */
function actorHasPermission(
  users: User[],
  actorId: string,
  pick: (p: User["permissions"]) => boolean,
): boolean {
  const actor = users.find((u) => u.id === actorId);
  // "sistema" (seed) não está na lista e não chama ações protegidas.
  if (!actor || !actor.active) return false;
  return pick(actor.permissions);
}

const PERMISSION_DENIED = "Você não tem permissão para executar esta ação.";

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUsersStore = create<UsersStore>()(
  persist(
    (set, get) => ({
      users: [],
      auditLogs: [],
      seeded: false,

      seed(adminPasswordHash) {
        if (get().seeded) return;
        const admin: User = {
          id: uid(),
          username: "RenatoFerreira",
          name: "Renato Ferreira",
          email: undefined,
          passwordHash: adminPasswordHash,
          role: "ADMIN",
          active: true,
          mustChangePassword: false,
          permissions: FULL_PERMISSIONS,
          createdAt: now(),
          updatedAt: now(),
          createdBy: "sistema",
        };
        set({
          users: [admin],
          seeded: true,
          auditLogs: [
            {
              id: uid(),
              action: "USER_SEEDED",
              actorName: "sistema",
              targetUserId: admin.id,
              targetName: admin.name,
              message: "Administrador inicial criado pelo sistema.",
              createdAt: now(),
            },
          ],
        });
      },

      getUserById(id) {
        return get().users.find((u) => u.id === id);
      },

      getUserByUsername(username) {
        return get().users.find(
          (u) => u.username.toLowerCase() === username.toLowerCase(),
        );
      },

      createUser(input, actorId, actorName) {
        const state = get();
        if (!actorHasPermission(state.users, actorId, (p) => p.users.create)) {
          get().addAuditLog({
            action: "ACTION_DENIED",
            actorUserId: actorId,
            actorName,
            message: `${actorName} tentou criar um usuário sem permissão.`,
          });
          return { ok: false, error: PERMISSION_DENIED };
        }
        const usernameTaken = state.users.some(
          (u) => u.username.toLowerCase() === input.username.toLowerCase(),
        );
        if (usernameTaken) {
          return { ok: false, error: "Nome de usuário já está em uso." };
        }
        if (input.email?.trim()) {
          const emailTaken = state.users.some(
            (u) => u.email?.toLowerCase() === input.email!.toLowerCase(),
          );
          if (emailTaken) {
            return { ok: false, error: "E-mail já está cadastrado." };
          }
        }
        const user: User = {
          id: uid(),
          username: input.username.trim(),
          name: input.name.trim(),
          email: input.email?.trim() || undefined,
          passwordHash: input.passwordHash,
          role: input.role,
          active: input.active,
          mustChangePassword: input.mustChangePassword,
          permissions: input.permissions ?? getDefaultPermissions(input.role),
          createdAt: now(),
          updatedAt: now(),
          createdBy: input.createdBy,
        };
        set((s) => ({ users: [...s.users, user] }));
        get().addAuditLog({
          action: "USER_CREATED",
          actorUserId: actorId,
          actorName,
          targetUserId: user.id,
          targetName: user.name,
          message: `${actorName} criou o usuário ${user.name} (${user.username}).`,
        });
        return { ok: true, user };
      },

      updateUser(id, patch, actorId, actorName) {
        const target = get().users.find((u) => u.id === id);
        if (!target) return { ok: false, error: "Usuário não encontrado." };

        // Permissão: editar dados exige users.edit; alterar permissões exige managePermissions.
        const changesPermissions = patch.permissions !== undefined;
        const allowed = actorHasPermission(get().users, actorId, (p) =>
          changesPermissions ? p.users.managePermissions : p.users.edit,
        );
        if (!allowed) {
          get().addAuditLog({
            action: "ACTION_DENIED",
            actorUserId: actorId,
            actorName,
            targetUserId: id,
            targetName: target.name,
            message: `${actorName} tentou editar ${target.name} sem permissão.`,
          });
          return { ok: false, error: PERMISSION_DENIED };
        }

        // Impede inativar a si mesmo
        if (patch.active === false && id === actorId) {
          return { ok: false, error: "Você não pode inativar a si mesmo." };
        }

        // Impede que o único admin ativo seja inativado
        if (patch.active === false && target.role === "ADMIN") {
          if (countActiveAdmins(get().users) <= 1) {
            return { ok: false, error: "Não é possível inativar o único administrador ativo." };
          }
        }

        // Impede remoção de role admin se for o único
        if (patch.role && patch.role !== "ADMIN" && target.role === "ADMIN") {
          if (countActiveAdmins(get().users) <= 1) {
            return { ok: false, error: "Não é possível remover o único administrador ativo." };
          }
        }

        const updated: User = {
          ...target,
          ...patch,
          updatedAt: now(),
          updatedBy: actorId,
        };

        set((s) => ({ users: s.users.map((u) => (u.id === id ? updated : u)) }));
        get().addAuditLog({
          action: "USER_UPDATED",
          actorUserId: actorId,
          actorName,
          targetUserId: id,
          targetName: target.name,
          message: `${actorName} editou os dados do usuário ${target.name}.`,
        });
        return { ok: true };
      },

      setPasswordHash(id, hash, mustChange, actorId, actorName) {
        // Troca da própria senha é sempre permitida; redefinir a de terceiros exige users.resetPassword.
        if (id !== actorId && !actorHasPermission(get().users, actorId, (p) => p.users.resetPassword)) {
          get().addAuditLog({
            action: "ACTION_DENIED",
            actorUserId: actorId,
            actorName,
            targetUserId: id,
            message: `${actorName} tentou redefinir a senha de outro usuário sem permissão.`,
          });
          return { ok: false };
        }
        set((s) => ({
          users: s.users.map((u) =>
            u.id === id
              ? { ...u, passwordHash: hash, mustChangePassword: mustChange, updatedAt: now(), updatedBy: actorId }
              : u,
          ),
        }));
        const target = get().users.find((u) => u.id === id);
        const isSelf = id === actorId;
        get().addAuditLog({
          action: isSelf ? "PASSWORD_SELF_CHANGED" : "PASSWORD_RESET",
          actorUserId: actorId,
          actorName,
          targetUserId: id,
          targetName: target?.name,
          message: isSelf
            ? `${actorName} alterou a própria senha.`
            : `${actorName} redefiniu a senha do usuário ${target?.name ?? id}.`,
        });
        return { ok: true };
      },

      promoteAdmin(id, actorId, actorName) {
        if (!actorHasPermission(get().users, actorId, (p) => p.users.promoteAdmin)) {
          get().addAuditLog({
            action: "ACTION_DENIED",
            actorUserId: actorId,
            actorName,
            targetUserId: id,
            message: `${actorName} tentou promover um usuário a administrador sem permissão.`,
          });
          return { ok: false, error: PERMISSION_DENIED };
        }
        const target = get().users.find((u) => u.id === id);
        if (!target) return { ok: false, error: "Usuário não encontrado." };
        set((s) => ({
          users: s.users.map((u) =>
            u.id === id
              ? { ...u, role: "ADMIN" as UserRole, permissions: FULL_PERMISSIONS, updatedAt: now(), updatedBy: actorId }
              : u,
          ),
        }));
        get().addAuditLog({
          action: "USER_PROMOTED_ADMIN",
          actorUserId: actorId,
          actorName,
          targetUserId: id,
          targetName: target.name,
          message: `${actorName} promoveu ${target.name} para Administrador.`,
        });
        return { ok: true };
      },

      revokeAdmin(id, actorId, actorName) {
        const state = get();
        if (!actorHasPermission(state.users, actorId, (p) => p.users.promoteAdmin)) {
          get().addAuditLog({
            action: "ACTION_DENIED",
            actorUserId: actorId,
            actorName,
            targetUserId: id,
            message: `${actorName} tentou remover o perfil de administrador sem permissão.`,
          });
          return { ok: false, error: PERMISSION_DENIED };
        }
        if (countActiveAdmins(state.users) <= 1) {
          return { ok: false, error: "Não é possível remover o único administrador ativo." };
        }
        const target = state.users.find((u) => u.id === id);
        if (!target) return { ok: false, error: "Usuário não encontrado." };
        set((s) => ({
          users: s.users.map((u) =>
            u.id === id
              ? { ...u, role: "VIEWER" as UserRole, permissions: getDefaultPermissions("VIEWER"), updatedAt: now(), updatedBy: actorId }
              : u,
          ),
        }));
        get().addAuditLog({
          action: "USER_REVOKED_ADMIN",
          actorUserId: actorId,
          actorName,
          targetUserId: id,
          targetName: target.name,
          message: `${actorName} removeu o perfil de administrador de ${target.name}.`,
        });
        return { ok: true };
      },

      inactivateUser(id, actorId, actorName) {
        const state = get();
        if (!actorHasPermission(state.users, actorId, (p) => p.users.delete)) {
          get().addAuditLog({
            action: "ACTION_DENIED",
            actorUserId: actorId,
            actorName,
            targetUserId: id,
            message: `${actorName} tentou inativar um usuário sem permissão.`,
          });
          return { ok: false, error: PERMISSION_DENIED };
        }
        if (id === actorId) {
          return { ok: false, error: "Você não pode inativar a si mesmo." };
        }
        const target = state.users.find((u) => u.id === id);
        if (!target) return { ok: false, error: "Usuário não encontrado." };
        if (target.role === "ADMIN" && countActiveAdmins(state.users) <= 1) {
          return { ok: false, error: "Não é possível inativar o único administrador ativo." };
        }
        set((s) => ({
          users: s.users.map((u) =>
            u.id === id ? { ...u, active: false, updatedAt: now(), updatedBy: actorId } : u,
          ),
        }));
        get().addAuditLog({
          action: "USER_INACTIVATED",
          actorUserId: actorId,
          actorName,
          targetUserId: id,
          targetName: target.name,
          message: `${actorName} inativou o usuário ${target.name}.`,
        });
        return { ok: true };
      },

      activateUser(id, actorId, actorName) {
        const target = get().users.find((u) => u.id === id);
        set((s) => ({
          users: s.users.map((u) =>
            u.id === id ? { ...u, active: true, updatedAt: now(), updatedBy: actorId } : u,
          ),
        }));
        get().addAuditLog({
          action: "USER_ACTIVATED",
          actorUserId: actorId,
          actorName,
          targetUserId: id,
          targetName: target?.name ?? id,
          message: `${actorName} ativou o usuário ${target?.name ?? id}.`,
        });
        return { ok: true };
      },

      recordLogin(id) {
        set((s) => ({
          users: s.users.map((u) =>
            u.id === id ? { ...u, lastLoginAt: now() } : u,
          ),
        }));
      },

      addAuditLog(entry) {
        const log: AuditLog = { id: uid(), createdAt: now(), ...entry };
        set((s) => ({ auditLogs: [log, ...s.auditLogs].slice(0, 2000) }));
      },
    }),
    {
      name: "tsteck:users",
      version: 1,
      partialize: (s) => ({
        users: s.users.map((u) => ({
          ...u,
          // Nunca strip - o hash é necessário para autenticação
        })),
        auditLogs: s.auditLogs,
        seeded: s.seeded,
      }),
    },
  ),
);
