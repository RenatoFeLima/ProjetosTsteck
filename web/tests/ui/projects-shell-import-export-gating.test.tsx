import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { UserRole } from "@/features/auth/lib/auth-types";

// App Router não está montado no jsdom — mock mínimo do useRouter.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
}));

// Mock de sessão controlável por teste. Definimos o role/permissões antes de
// renderizar o shell; o hook lê deste objeto mutável.
const mockSession: { user: { name: string; username: string; role: UserRole; permissions: ReturnType<typeof getDefaultPermissions>; sellerId: string | null } } | null = {
  user: { name: "Teste", username: "teste", role: "ADMIN", permissions: getDefaultPermissions("ADMIN"), sellerId: null },
};
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ session: mockSession, isLoading: false }),
}));

import { ProjectsPageShell } from "@/features/projects/components/projects-page-shell";

function setRole(role: UserRole) {
  mockSession!.user.role = role;
  mockSession!.user.permissions = getDefaultPermissions(role);
  // SELLER precisa de sellerId para não cair só no aviso; irrelevante para os botões.
  mockSession!.user.sellerId = role === "SELLER" ? "seller-1" : null;
}

const importLabel = /Importar atualizações de projetos via Excel\/CSV/i;
const exportLabel = /Exportar todos os projetos para Excel/i;

afterEach(() => cleanup());

describe("ProjectsPageShell — gating de importar/exportar por role", () => {
  it("1. ADMIN vê o botão Importar", () => {
    setRole("ADMIN");
    render(<ProjectsPageShell />);
    expect(screen.getByRole("button", { name: importLabel })).toBeInTheDocument();
  });

  it("2. SELLER NÃO vê o botão Importar", () => {
    setRole("SELLER");
    render(<ProjectsPageShell />);
    expect(screen.queryByRole("button", { name: importLabel })).not.toBeInTheDocument();
  });

  it("3. COMMERCIAL NÃO vê o botão Importar", () => {
    setRole("COMMERCIAL");
    render(<ProjectsPageShell />);
    expect(screen.queryByRole("button", { name: importLabel })).not.toBeInTheDocument();
  });

  it("PROJECTS (não-ADMIN) NÃO vê o botão Importar", () => {
    setRole("PROJECTS");
    render(<ProjectsPageShell />);
    expect(screen.queryByRole("button", { name: importLabel })).not.toBeInTheDocument();
  });

  it("ADMIN vê o botão Exportar", () => {
    setRole("ADMIN");
    render(<ProjectsPageShell />);
    expect(screen.getByRole("button", { name: exportLabel })).toBeInTheDocument();
  });

  it("9. SELLER NÃO vê o botão Exportar", () => {
    setRole("SELLER");
    render(<ProjectsPageShell />);
    expect(screen.queryByRole("button", { name: exportLabel })).not.toBeInTheDocument();
  });

  it("10. COMMERCIAL NÃO vê o botão Exportar (kpis.export=false)", () => {
    setRole("COMMERCIAL");
    render(<ProjectsPageShell />);
    expect(screen.queryByRole("button", { name: exportLabel })).not.toBeInTheDocument();
  });
});
