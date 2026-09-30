import { describe, expect, it } from "vitest";
import { resolveProjectScope, SELLER_WITHOUT_LINK_MESSAGE, type ScopeUser } from "@/features/auth/lib/project-scope";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { UserRole } from "@/features/auth/lib/auth-types";

// Múltiplos vendedores: o escopo do SELLER é o CONJUNTO de vendedores
// vinculados (UserSeller). O espelho legado `sellerId` não participa.

function user(role: UserRole, sellerIds: string[], extra: Record<string, unknown> = {}): ScopeUser {
  return { role, permissions: getDefaultPermissions(role), sellerIds, ...extra } as ScopeUser;
}

describe("resolveProjectScope — múltiplos vendedores", () => {
  it.each([
    ["1 vendedor", ["A"]],
    ["2 vendedores", ["A", "B"]],
    ["20 vendedores", Array.from({ length: 20 }, (_, i) => `S${i}`)],
  ])("SELLER com %s → own com exatamente esse conjunto", (_l, ids) => {
    expect(resolveProjectScope(user("SELLER", ids))).toEqual({ kind: "own", sellerIds: ids });
  });

  it("IDs duplicados ou vazios não alteram o conjunto", () => {
    expect(resolveProjectScope(user("SELLER", ["A", "B", "A", ""]))).toEqual({ kind: "own", sellerIds: ["A", "B"] });
  });

  it("zero vendedores NUNCA significa todos: bloqueado", () => {
    const scope = resolveProjectScope(user("SELLER", []));
    expect(scope).toEqual({ kind: "blocked", reason: SELLER_WITHOUT_LINK_MESSAGE });
  });

  it("sellerIds ausente (sessão sem a relação carregada) falha fechado: bloqueado", () => {
    const scope = resolveProjectScope({ role: "SELLER", permissions: getDefaultPermissions("SELLER") } as unknown as ScopeUser);
    expect(scope.kind).toBe("blocked");
  });

  it("CONTRAPROVA: sellerId legado = A com sellerIds = [B, C] → escopo só B e C", () => {
    const scope = resolveProjectScope(user("SELLER", ["B", "C"], { sellerId: "A" }));
    expect(scope).toEqual({ kind: "own", sellerIds: ["B", "C"] });
  });

  it("CONTRAPROVA: sellerId legado presente mas sellerIds vazio → bloqueado (legado não concede acesso)", () => {
    expect(resolveProjectScope(user("SELLER", [], { sellerId: "A" })).kind).toBe("blocked");
  });

  it.each(["ADMIN", "MANAGER", "PROJECTS", "COMMERCIAL", "VIEWER", "CUSTOM"] as UserRole[])(
    "%s continua vendo tudo, com ou sem vínculos",
    (role) => {
      expect(resolveProjectScope(user(role, [])).kind).toBe("all");
      expect(resolveProjectScope(user(role, ["A"])).kind).toBe("all");
    },
  );
});
