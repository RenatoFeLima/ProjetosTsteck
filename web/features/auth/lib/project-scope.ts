// Escopo de visibilidade de projetos por usuário (defesa em profundidade).
// Módulo PURO (sem Prisma) — usado pelos services para decidir QUAIS projetos
// um usuário pode ver/baixar. Nunca confiar apenas no frontend.
//
// Regras:
//   - role SELLER  → vê SOMENTE os projetos dos seus vendedores vinculados
//                    (sellerIds, vindos de UserSeller). Nenhum vendedor →
//                    bloqueado (mensagem amigável). Zero NUNCA significa "todos".
//   - demais roles com projects.view → vê TODOS (escopo "all").
// O espelho legado `sellerId` (Release 1) NÃO participa do escopo.

import type { UserRole, UserPermissions } from "./auth-types";

export type ScopeUser = {
  role: UserRole;
  permissions: UserPermissions;
  sellerIds: readonly string[];
};

export type ProjectScope =
  | { kind: "all" }
  | { kind: "own"; sellerIds: string[] }
  | { kind: "blocked"; reason: string };

export const SELLER_WITHOUT_LINK_MESSAGE =
  "Usuário vendedor sem cadastro de vendedor vinculado. Contate o administrador.";

/** Decide o escopo de visibilidade de projetos do usuário. */
export function resolveProjectScope(user: ScopeUser): ProjectScope {
  if (user.role === "SELLER") {
    const sellerIds = [...new Set((user.sellerIds ?? []).filter(Boolean))];
    if (sellerIds.length === 0) {
      return { kind: "blocked", reason: SELLER_WITHOUT_LINK_MESSAGE };
    }
    return { kind: "own", sellerIds };
  }
  return { kind: "all" };
}

/** true se o usuário pode ver KPIs/analytics (escopo + permissão). */
export function canViewKpis(user: ScopeUser): boolean {
  // Vendedor nunca vê KPI, mesmo que a permissão venha marcada por engano.
  if (user.role === "SELLER") return false;
  return Boolean(user.permissions.kpis.view);
}

// Perfis comerciais são estritamente READ-ONLY (visualização), por ROLE — vale
// mesmo para usuários antigos cujo permissionsJson no banco ainda tenha flags de
// escrita marcadas. Defesa em profundidade independente do que está persistido.
export const READ_ONLY_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(["SELLER", "COMMERCIAL"]);

/** Perfil estritamente de visualização (não muta nada de projeto)? */
export function isReadOnlyRole(role: UserRole): boolean {
  return READ_ONLY_ROLES.has(role);
}

/** true se o usuário pode MUTAR projetos (editar/criar/status/urgência/código).
 *  Perfis comerciais nunca podem, independentemente do permissionsJson. */
export function canMutateProjects(user: Pick<ScopeUser, "role">): boolean {
  return !isReadOnlyRole(user.role);
}

/** true se o usuário pode MOVER cards no Kanban (drag-and-drop / mudar status). */
export function canMoveProjects(user: ScopeUser): boolean {
  if (isReadOnlyRole(user.role)) return false;
  return Boolean(user.permissions.projects.changeStatus);
}
