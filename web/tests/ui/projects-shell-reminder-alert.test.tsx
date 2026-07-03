import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { UserRole } from "@/features/auth/lib/auth-types";
import type { ProjectReminder } from "@/features/projects/domain/project-reminders";

// App Router não está montado no jsdom — mock mínimo do useRouter.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
}));

const mockSession: { user: { name: string; username: string; role: UserRole; permissions: ReturnType<typeof getDefaultPermissions>; sellerId: string | null } } | null = {
  user: { name: "Teste", username: "teste", role: "PROJECTS", permissions: getDefaultPermissions("PROJECTS"), sellerId: null },
};
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ session: mockSession, isLoading: false }),
}));

// API de lembretes mockada: 1 lembrete vencido → deve disparar o modal.
const dueReminder: ProjectReminder = {
  id: "r1",
  projeto_id: "p1",
  descricao: "Validar com o vendedor a quantidade de itens locados nessa obra.",
  prioridade: "ALTA",
  status: "PENDENTE",
  data_inicial: "2026-06-01",
  proxima_data: "2026-06-01",
  recorrencia_dias: 7,
  criado_por: "Renato",
  criado_em: "2026-06-01T10:00:00.000Z",
  atualizado_em: "2026-06-01T10:00:00.000Z",
};

const { apiListRemindersMock } = vi.hoisted(() => ({ apiListRemindersMock: vi.fn(async () => [] as unknown[]) }));
vi.mock("@/features/projects/lib/reminders-api", () => ({
  apiListReminders: apiListRemindersMock,
  apiCreateReminder: vi.fn(),
  apiUpdateReminder: vi.fn(),
  apiPostponeReminder: vi.fn(),
  apiResolveReminder: vi.fn(),
  apiRemoveReminder: vi.fn(),
}));

import { ProjectsPageShell } from "@/features/projects/components/projects-page-shell";
import { useProjectsStore } from "@/features/projects/state/projects-store";

function setRole(role: UserRole) {
  mockSession!.user.role = role;
  mockSession!.user.permissions = getDefaultPermissions(role);
  mockSession!.user.sellerId = role === "SELLER" ? "seller-1" : null;
}

beforeEach(() => {
  window.sessionStorage.clear();
  useProjectsStore.setState({ reminders: [] });
  apiListRemindersMock.mockResolvedValue([dueReminder]);
});

afterEach(() => {
  cleanup();
  useProjectsStore.setState({ reminders: [] });
});

describe("ProjectsPageShell — modal de lembretes ao entrar (1x por sessão)", () => {
  it("11. equipe de Projetos com lembrete vencido vê o modal ao entrar", async () => {
    setRole("PROJECTS");
    render(<ProjectsPageShell />);
    expect(await screen.findByText("Lembretes pendentes")).toBeInTheDocument();
    expect(screen.getByText(/Validar com o vendedor/)).toBeInTheDocument();
  });

  it("o modal aparece no máximo 1x por sessão (sessionStorage)", async () => {
    setRole("ADMIN");
    const first = render(<ProjectsPageShell />);
    expect(await screen.findByText("Lembretes pendentes")).toBeInTheDocument();
    expect(window.sessionStorage.getItem("tsteck:reminders:alerted")).toBe("1");
    first.unmount();

    render(<ProjectsPageShell />);
    // Recarregar a página na MESMA sessão não reabre o modal.
    await waitFor(() => expect(apiListRemindersMock).toHaveBeenCalled());
    expect(screen.queryByText("Lembretes pendentes")).not.toBeInTheDocument();
  });

  it("SELLER não recebe o modal de alerta de lembretes", async () => {
    setRole("SELLER");
    render(<ProjectsPageShell />);
    await waitFor(() => expect(apiListRemindersMock).toHaveBeenCalled());
    expect(screen.queryByText("Lembretes pendentes")).not.toBeInTheDocument();
  });

  it("sem lembretes vencidos/do dia, o modal não abre", async () => {
    setRole("PROJECTS");
    apiListRemindersMock.mockResolvedValue([
      { ...dueReminder, proxima_data: "2099-12-31" }, // só futuro
    ]);
    render(<ProjectsPageShell />);
    await waitFor(() => expect(apiListRemindersMock).toHaveBeenCalled());
    expect(screen.queryByText("Lembretes pendentes")).not.toBeInTheDocument();
    // E a sessão NÃO fica marcada — se um lembrete vencer, o próximo login alerta.
    expect(window.sessionStorage.getItem("tsteck:reminders:alerted")).toBeNull();
  });
});
