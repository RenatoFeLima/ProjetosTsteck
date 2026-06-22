import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
}));

// Sessão ADMIN (tem permissão de exportar).
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({
    session: { user: { name: "Admin", username: "admin", role: "ADMIN", permissions: getDefaultPermissions("ADMIN"), sellerId: null } },
    isLoading: false,
  }),
}));

// Espia a API de exportação — não queremos chamada de rede real.
// vi.hoisted garante que o spy exista antes do factory hoisteado do vi.mock.
const { apiExportProjects } = vi.hoisted(() => ({ apiExportProjects: vi.fn(async () => {}) }));
vi.mock("@/features/projects/lib/projects-api", async (orig) => {
  const actual = await orig<typeof import("@/features/projects/lib/projects-api")>();
  return { ...actual, apiExportProjects };
});

import { ProjectsPageShell } from "@/features/projects/components/projects-page-shell";

const exportLabel = /Exportar todos os projetos para Excel/i;

beforeEach(() => apiExportProjects.mockClear());
afterEach(() => cleanup());

describe("ProjectsPageShell — fluxo de exportação com confirmação", () => {
  it("5. clicar em Exportar abre o modal de confirmação e NÃO chama a API ainda", async () => {
    const user = userEvent.setup();
    render(<ProjectsPageShell />);

    await user.click(screen.getByRole("button", { name: exportLabel }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Confirmar exportação/i)).toBeInTheDocument();
    expect(apiExportProjects).not.toHaveBeenCalled();
  });

  it("6. cancelar o modal fecha e NÃO chama a API", async () => {
    const user = userEvent.setup();
    render(<ProjectsPageShell />);

    await user.click(screen.getByRole("button", { name: exportLabel }));
    await user.click(screen.getByRole("button", { name: /^Cancelar$/i }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(apiExportProjects).not.toHaveBeenCalled();
  });

  it("7. confirmar chama a API de exportação exatamente uma vez", async () => {
    const user = userEvent.setup();
    render(<ProjectsPageShell />);

    await user.click(screen.getByRole("button", { name: exportLabel }));
    // Botão de confirmação dentro do modal.
    await user.click(screen.getByRole("button", { name: /Exportar CSV/i }));

    await waitFor(() => expect(apiExportProjects).toHaveBeenCalledTimes(1));
  });
});
