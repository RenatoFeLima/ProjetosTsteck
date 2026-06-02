import type { UserPermissions } from "./auth-types";

/**
 * Mapa central de permissões por rota.
 *
 * Cada regra associa um prefixo de rota a uma verificação de permissão.
 * A camada de layout consulta este mapa para bloquear o acesso direto via URL
 * (não basta esconder o item no menu). A regra de prefixo mais longa vence.
 */
export type RoutePermissionRule = {
  /** Prefixo da rota (ex.: "/administracao"). "/" só casa com a raiz exata. */
  prefix: string;
  /** Verificação aplicada às permissões do usuário logado. */
  check: (perms: UserPermissions) => boolean;
  /** Rótulo amigável usado em logs de auditoria. */
  label: string;
};

export const ROUTE_PERMISSIONS: RoutePermissionRule[] = [
  { prefix: "/administracao", label: "Administração de usuários", check: (p) => p.users.view },
  { prefix: "/auditoria", label: "Auditoria", check: (p) => p.audit.view },
  { prefix: "/configuracoes", label: "Configurações", check: (p) => p.settings.view },
  { prefix: "/cadastros", label: "Cadastros", check: (p) => p.masterData.view },
  { prefix: "/", label: "Projetos", check: (p) => p.projects.view },
];

/**
 * Resolve a regra de permissão aplicável a um pathname.
 * Retorna a regra de prefixo mais específico (mais longo) que casa.
 */
export function resolveRouteRule(pathname: string): RoutePermissionRule | undefined {
  const candidates = ROUTE_PERMISSIONS.filter((r) =>
    r.prefix === "/" ? pathname === "/" : pathname === r.prefix || pathname.startsWith(r.prefix + "/") || pathname === r.prefix,
  );
  return candidates.sort((a, b) => b.prefix.length - a.prefix.length)[0];
}

/**
 * Indica se o usuário pode acessar o pathname.
 * Rotas sem regra são liberadas por padrão (apenas exigem autenticação).
 */
export function canAccessRoute(pathname: string, perms: UserPermissions): boolean {
  const rule = resolveRouteRule(pathname);
  return rule ? rule.check(perms) : true;
}
