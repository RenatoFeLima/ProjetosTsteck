import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { UserRole } from "@/features/auth/lib/auth-types";
import type { Project } from "@/features/projects/domain/project-types";

// Filtro "Vendedor" do perfil Vendedor: as opções saem SÓ dos projetos que o
// servidor entregou (escopo já aplicado no backend) — nunca dos cadastros.

const auth = vi.hoisted(() => ({ session: null as unknown }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("@/features/auth/hooks/use-auth", () => ({ useAuth: () => ({ session: auth.session, isLoading: false }) }));
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
const hydrate = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/features/master-data/lib/master-data-hydrate", () => ({ hydrateMasterDataFromApi: hydrate }));

import { ProjectsPageShell } from "@/features/projects/components/projects-page-shell";
import { useProjectsStore } from "@/features/projects/state/projects-store";
import { useMasterDataStore } from "@/features/master-data/state/master-data-store";
import * as api from "@/features/projects/lib/projects-api";

function installMatchMedia() {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    return { media: query, matches: min ? 1280 >= Number(min[1]) : false, onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => true };
  }) as unknown as typeof window.matchMedia;
}
function project(n: number, vendedor: string): Project {
  return {
    id: `p${n}`, construtora: `C${n}`, obra: `O${n}`, equipamento: "EK", codigo_projeto: `CRE-000-${String(n).padStart(4, "0")}`, vendedor,
    proj_obra_recebido: true, local_cabine_definido: true, alinhamento: true, data_lancamento: "2026-05-01", data_alinhamento: "2026-05-02",
    status_atual: "ELABORAR ANTE-PROJETO", status_entered_at: "2026-05-10", data_envio: null, data_aprovacao: null, urgente: false,
    reviewCount: 0, reviewHistory: [], finalReviewCount: 0, finalReviewHistory: [], created_at: "2026-05-01", updated_at: "2026-05-10",
  } as Project;
}
function login(role: UserRole, sellerIds: string[]) {
  auth.session = { user: { name: "Teste", username: "teste", role, permissions: getDefaultPermissions(role), sellerIds } };
}
async function vendorOptions(): Promise<string[]> {
  await userEvent.click(screen.getByRole("button", { name: /^Filtros/ }));
  await userEvent.click(screen.getByRole("button", { name: "Filtrar por vendedor" }));
  // Só as opções do combobox de busca (botões); os <option> nativos de outros
  // selects da tela ficam de fora. O rótulo é exibido capitalizado ("Mônica").
  return screen
    .getAllByRole("option")
    .filter((o) => o.tagName === "BUTTON")
    .map((o) => (o.textContent ?? "").trim().toLocaleUpperCase("pt-BR"));
}

beforeEach(() => {
  installMatchMedia();
  window.sessionStorage.setItem("tsteck:reminders:alerted", "1");
  useProjectsStore.setState({
    projects: [],
    loadStatus: "idle",
    reminders: [],
    activeView: "table",
    filters: { search: "", status: "all", construtora: "", obra: "", vendedor: "", equipamento: "", tipoCabineId: "", atrasadoOnly: false, urgenteOnly: false },
  });
  // Mesmo que o cadastro local tivesse outros vendedores (C), o SELLER não os vê.
  const base = { active: true, createdAt: "2026-01-01", updatedAt: "2026-01-01", createdBy: "t" };
  useMasterDataStore.setState({ vendedores: [{ id: "sA", name: "MÔNICA", ...base }, { id: "sB", name: "CARLOS", ...base }, { id: "sC", name: "JULIANA", ...base }] as never });
});
afterEach(() => cleanup());

describe("filtro Vendedor — perfil Vendedor A + B", () => {
  it("opções = vendedores dos projetos entregues (A e B); nunca C", async () => {
    login("SELLER", ["sA", "sB"]);
    vi.mocked(api.apiListProjects).mockResolvedValue([project(1, "MÔNICA"), project(2, "CARLOS"), project(3, "MÔNICA")]);
    render(<ProjectsPageShell />);
    await waitFor(() => expect(useProjectsStore.getState().loadStatus).toBe("ready"));
    const options = await vendorOptions();
    expect(options).toContain("CARLOS");
    expect(options).toContain("MÔNICA");
    expect(options).not.toContain("JULIANA");
  });

  it("filtrar por A mostra só A; por B só B", async () => {
    login("SELLER", ["sA", "sB"]);
    vi.mocked(api.apiListProjects).mockResolvedValue([project(1, "MÔNICA"), project(2, "CARLOS")]);
    render(<ProjectsPageShell />);
    await waitFor(() => expect(useProjectsStore.getState().loadStatus).toBe("ready"));
    useProjectsStore.getState().setFilters({ vendedor: "MÔNICA" });
    expect(useProjectsStore.getState().filteredProjects().map((p) => p.vendedor)).toEqual(["MÔNICA"]);
    useProjectsStore.getState().setFilters({ vendedor: "CARLOS" });
    expect(useProjectsStore.getState().filteredProjects().map((p) => p.vendedor)).toEqual(["CARLOS"]);
  });

  it("sem vínculo: aviso de vendedor não vinculado continua", async () => {
    login("SELLER", []);
    render(<ProjectsPageShell />);
    expect(await screen.findByText("Usuário vendedor sem cadastro de vendedor vinculado. Contate o administrador.")).toBeInTheDocument();
  });

  it("perfil não-Vendedor continua usando o cadastro de vendedores (inclui C)", async () => {
    login("ADMIN", []);
    vi.mocked(api.apiListProjects).mockResolvedValue([project(1, "MÔNICA")]);
    render(<ProjectsPageShell />);
    await waitFor(() => expect(useProjectsStore.getState().loadStatus).toBe("ready"));
    expect(await vendorOptions()).toContain("JULIANA");
  });
});
