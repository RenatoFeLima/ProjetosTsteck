// Escopo de visibilidade de projetos por usuário (defesa em profundidade).
// Módulo PURO (sem Prisma) — usado pelos services para decidir QUAIS projetos
// um usuário pode ver/baixar. Nunca confiar apenas no frontend.
//
// Regras:
//   - role SELLER  → vê SOMENTE os projetos do seu vendedor (sellerId).
//                    Sem vendedor vinculado → bloqueado (mensagem amigável).
//   - demais roles com projects.view → vê TODOS (escopo "all").

import type { UserRole, UserPermissions } from "./auth-types";

export type ScopeUser = {
  role: UserRole;
  permissions: UserPermissions;
  sellerId: string | null;
};

export type ProjectScope =
  | { kind: "all" }
  | { kind: "own"; sellerId: string }
  | { kind: "blocked"; reason: string };

export const SELLER_WITHOUT_LINK_MESSAGE =
  "Usuário vendedor sem cadastro de vendedor vinculado. Contate o administrador.";

/** Decide o escopo de visibilidade de projetos do usuário. */
export function resolveProjectScope(user: ScopeUser): ProjectScope {
  if (user.role === "SELLER") {
    if (!user.sellerId) {
      return { kind: "blocked", reason: SELLER_WITHOUT_LINK_MESSAGE };
    }
    return { kind: "own", sellerId: user.sellerId };
  }
  return { kind: "all" };
}

/** true se o usuário pode ver KPIs/analytics (escopo + permissão). */
export function canViewKpis(user: ScopeUser): boolean {
  // Vendedor nunca vê KPI, mesmo que a permissão venha marcada por engano.
  if (user.role === "SELLER") return false;
  return Boolean(user.permissions.kpis.view);
}
