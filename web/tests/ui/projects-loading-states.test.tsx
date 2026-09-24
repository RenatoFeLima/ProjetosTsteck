import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { Project } from "@/features/projects/domain/project-types";

// Estados loading / vazio / erro da tela de Projetos: nada de "0 projetos" ou
// "Nenhum projeto…" enquanto a 1ª consulta não termina.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({
    session: {
      user: { name: "Teste", username: "teste", role: "PROJECTS", permissions: getDefaultPermissions("PROJECTS"), sellerId: null },
    },
    isLoading: false,
  }),
}));

vi.mock("@/features/projects/lib/projects-api", async (orig) => ({
  ...(await orig<typeof import("@/features/projects/lib/projects-api")>()),
  apiListProjects: vi.fn(async () => []),
}));

vi.mock("@/features/projects/lib/reminders-api", () => ({
  apiListReminders: vi.fn(async () => []),
  apiCreateReminder: vi.fn(),
  apiUpdateReminder: vi.fn(),
  apiPostponeReminder: vi.fn(),
  apiResolveReminder: vi.fn(),
  apiRemoveReminder: vi.fn(),
}));

vi.mock("@/features/master-data/lib/master-data-hydrate", () => ({
  hydrateMasterDataFromApi: vi.fn(async () => {}),
}));

import { ProjectsPageShell } from "@/features/projects/components/projects-page-shell";
import { useProjectsStore } from "@/features/projects/state/projects-store";
import * as api from "@/features/projects/lib/projects-api";

const EMPTY_MESSAGE = "Nenhum projeto corresponde aos filtros aplicados.";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  window.sessionStorage.clear();
  vi.mocked(api.apiListProjects).mockReset();
  useProjectsStore.setState({ projects: [], loadStatus: "idle", activeView: "table", reminders: [] });
});

afterEach(() => {
  cleanup();
});

describe("tela de Projetos — loading x vazio x erro", () => {
  it("durante a carga mostra skeleton, sem estado vazio falso nem contadores 0", async () => {
    const d = deferred<Project[]>();
    vi.mocked(api.apiListProjects).mockReturnValue(d.promise);

    render(<ProjectsPageShell />);

    expect(screen.getByText("Carregando projetos...")).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument();
    // Abas e KPIs não exibem "0" enquanto carrega.
    expect(screen.getByRole("button", { name: /Tabela/ })).toHaveTextContent("–");
    expect(screen.getByRole("button", { name: /Total de Projetos/i })).not.toHaveTextContent("0");

    await act(async () => {
      d.resolve([]);
      await d.promise;
    });
  });

  it("só mostra 'Nenhum projeto…' depois que a consulta termina vazia", async () => {
    vi.mocked(api.apiListProjects).mockResolvedValue([]);
    render(<ProjectsPageShell />);

    expect(await screen.findByText(EMPTY_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText("Carregando projetos...")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tabela/ })).toHaveTextContent("0");
  });

  it("erro na carga mostra estado de erro com retry real (chama a API de novo)", async () => {
    vi.mocked(api.apiListProjects).mockRejectedValueOnce(new Error("rede"));
    render(<ProjectsPageShell />);

    expect(await screen.findByText("Nao foi possivel carregar os projetos.")).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument();
    // Em erro a contagem é desconhecida: "–", nunca um 0 falso.
    expect(screen.getByRole("button", { name: /Tabela/ })).toHaveTextContent("–");
    expect(screen.getByRole("button", { name: /Tabela/ })).not.toHaveTextContent("0");

    vi.mocked(api.apiListProjects).mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/ }));

    await waitFor(() => expect(api.apiListProjects).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(EMPTY_MESSAGE)).toBeInTheDocument();
    // Pronto com resultado vazio: aí sim o 0 é real.
    expect(screen.getByRole("button", { name: /Tabela/ })).toHaveTextContent("0");
  });

  it("botão 'Novo projeto' não quebra linha", () => {
    vi.mocked(api.apiListProjects).mockResolvedValue([]);
    render(<ProjectsPageShell />);
    expect(screen.getByRole("button", { name: /Novo projeto/i })).toHaveClass("whitespace-nowrap");
  });

  it("Kanban em carregamento não exibe colunas com '0 projetos'", async () => {
    const d = deferred<Project[]>();
    vi.mocked(api.apiListProjects).mockReturnValue(d.promise);
    useProjectsStore.setState({ activeView: "kanban" });

    render(<ProjectsPageShell />);

    expect(screen.getByText("Carregando projetos...")).toBeInTheDocument();
    expect(screen.queryByText(/0 projetos/)).not.toBeInTheDocument();

    await act(async () => {
      d.resolve([]);
      await d.promise;
    });
    expect(screen.getAllByText(/0 projetos/).length).toBeGreaterThan(0);
  });
});
