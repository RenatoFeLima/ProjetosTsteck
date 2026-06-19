import { describe, expect, it } from "vitest";
import {
  resolveProjectScope,
  canViewKpis,
  canMutateProjects,
  canMoveProjects,
  isReadOnlyRole,
  SELLER_WITHOUT_LINK_MESSAGE,
  type ScopeUser,
} from "@/features/auth/lib/project-scope";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { UserRole } from "@/features/auth/lib/auth-types";

function user(role: UserRole, sellerId: string | null = null): ScopeUser {
  return { role, permissions: getDefaultPermissions(role), sellerId };
}

describe("project-scope — visibilidade por perfil", () => {
  it("vendedor com vínculo vê apenas os projetos do seu vendedor (own)", () => {
    const scope = resolveProjectScope(user("SELLER", "seller-1"));
    expect(scope).toEqual({ kind: "own", sellerId: "seller-1" });
  });

  it("vendedor SEM vínculo é bloqueado com mensagem amigável", () => {
    const scope = resolveProjectScope(user("SELLER", null));
    expect(scope.kind).toBe("blocked");
    if (scope.kind === "blocked") expect(scope.reason).toBe(SELLER_WITHOUT_LINK_MESSAGE);
  });

  it("admin, gerente comercial, projetos e viewer veem tudo (all)", () => {
    for (const role of ["ADMIN", "COMMERCIAL", "PROJECTS", "MANAGER", "VIEWER"] as UserRole[]) {
      expect(resolveProjectScope(user(role)).kind).toBe("all");
    }
  });

  it("vendedor nunca acessa KPI, mesmo com permissão marcada por engano", () => {
    const tampered: ScopeUser = {
      role: "SELLER",
      sellerId: "s1",
      permissions: { ...getDefaultPermissions("SELLER"), kpis: { view: true, export: true } },
    };
    expect(canViewKpis(tampered)).toBe(false);
  });

  it("gerente comercial e admin acessam KPI; viewer conforme permissão", () => {
    expect(canViewKpis(user("COMMERCIAL"))).toBe(true);
    expect(canViewKpis(user("ADMIN"))).toBe(true);
    expect(canViewKpis(user("PROJECTS"))).toBe(true);
  });
});

describe("permissões padrão do perfil Vendedor (SELLER)", () => {
  it("vê Kanban e projetos, mas não KPI, cadastros, usuários nem admin", () => {
    const p = getDefaultPermissions("SELLER");
    expect(p.projects.view).toBe(true);
    expect(p.kanban.view).toBe(true);
    expect(p.kpis.view).toBe(false);
    expect(p.alerts.view).toBe(false);
    expect(p.masterData.view).toBe(false);
    expect(p.users.view).toBe(false);
    expect(p.settings.view).toBe(false);
    expect(p.audit.view).toBe(false);
  });

  it("é somente leitura: não cria, edita, move status nem marca urgência", () => {
    const p = getDefaultPermissions("SELLER");
    expect(p.projects.create).toBe(false);
    expect(p.projects.edit).toBe(false);
    expect(p.projects.changeStatus).toBe(false);
    expect(p.projects.markUrgent).toBe(false);
    expect(p.kanban.dragAndDrop).toBe(false);
  });

  it("gerente comercial (COMMERCIAL) é read-only: vê projetos + KPI, sem admin/cadastros/edição", () => {
    const p = getDefaultPermissions("COMMERCIAL");
    expect(p.projects.view).toBe(true);
    expect(p.kpis.view).toBe(true);
    expect(p.users.view).toBe(false);
    // Read-only: nada de criar/editar/status/urgência, sem drag, sem cadastros/alertas.
    expect(p.projects.create).toBe(false);
    expect(p.projects.edit).toBe(false);
    expect(p.projects.changeStatus).toBe(false);
    expect(p.projects.markUrgent).toBe(false);
    expect(p.kanban.dragAndDrop).toBe(false);
    expect(p.masterData.view).toBe(false);
    expect(p.alerts.view).toBe(false);
    expect(p.settings.view).toBe(false);
  });
});

describe("project-scope — mutação e movimentação (read-only por role)", () => {
  it("SELLER e COMMERCIAL são read-only; nunca mutam nem movem cards", () => {
    for (const role of ["SELLER", "COMMERCIAL"] as UserRole[]) {
      expect(isReadOnlyRole(role)).toBe(true);
      // Mesmo com permissionsJson adulterado, não pode mutar/mover.
      const tampered: ScopeUser = {
        role,
        sellerId: "s1",
        permissions: {
          ...getDefaultPermissions(role),
          projects: { ...getDefaultPermissions(role).projects, edit: true, create: true, changeStatus: true, markUrgent: true },
          kanban: { view: true, dragAndDrop: true },
        },
      };
      expect(canMutateProjects(tampered)).toBe(false);
      expect(canMoveProjects(tampered)).toBe(false);
    }
  });

  it("ADMIN e PROJECTS podem mutar e mover cards", () => {
    for (const role of ["ADMIN", "PROJECTS"] as UserRole[]) {
      expect(isReadOnlyRole(role)).toBe(false);
      expect(canMutateProjects(user(role))).toBe(true);
      expect(canMoveProjects(user(role))).toBe(true);
    }
  });
});
