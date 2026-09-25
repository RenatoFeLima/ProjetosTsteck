import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { UserRole } from "@/features/auth/lib/auth-types";
import type { Project } from "@/features/projects/domain/project-types";

// Marcar/remover urgência pelo menu ⋯ usa POST/DELETE /urgency, que o servidor
// só aceita com projects.markUrgent. Sem ela o item fica desabilitado (antes
// aparecia habilitado para PROJECTS e o clique terminava em 403).

const auth = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("@/features/auth/hooks/use-auth", () => ({ useAuth: () => ({ session: auth.session, isLoading: false }) }));
vi.mock("@/features/projects/lib/projects-api", async (orig) => ({
  ...(await orig<typeof import("@/features/projects/lib/projects-api")>()),
  apiListProjects: vi.fn(async () => []),
  apiSetUrgency: vi.fn(),
}));
vi.mock("@/features/projects/lib/reminders-api", () => ({
  apiListReminders: vi.fn(async () => []),
  apiCreateReminder: vi.fn(),
  apiUpdateReminder: vi.fn(),
  apiPostponeReminder: vi.fn(),
  apiResolveReminder: vi.fn(),
  apiRemoveReminder: vi.fn(),
}));
vi.mock("@/features/master-data/lib/master-data-hydrate", () => ({ hydrateMasterDataFromApi: vi.fn(async () => {}) }));

import { ProjectsPageShell } from "@/features/projects/components/projects-page-shell";
import { useProjectsStore } from "@/features/projects/state/projects-store";
import * as api from "@/features/projects/lib/projects-api";

let width = 1280;
function installMatchMedia() {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    return {
      media: query,
      matches: min ? width >= Number(min[1]) : false,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    };
  }) as unknown as typeof window.matchMedia;
}

function project(n: number, overrides: Partial<Project> = {}): Project {
  return {
    id: `p${n}`,
    construtora: `CONSTRUTORA ${n}`,
    obra: `OBRA ${n}`,
    equipamento: "EK-15/26",
    codigo_projeto: `CRE-000-${String(n).padStart(4, "0")}`,
    vendedor: `VENDEDOR ${n}`,
    proj_obra_recebido: true,
    local_cabine_definido: true,
    alinhamento: true,
    data_lancamento: "2026-05-01",
    data_alinhamento: "2026-05-02",
    status_atual: "ELABORAR ANTE-PROJETO",
    status_entered_at: "2026-05-10",
    data_envio: null,
    data_aprovacao: null,
    urgente: false,
    reviewCount: 0,
    reviewHistory: [],
    finalReviewCount: 0,
    finalReviewHistory: [],
    created_at: "2026-05-01",
    updated_at: "2026-05-10",
    ...overrides,
  } as Project;
}

function login(role: UserRole, patch?: (p: ReturnType<typeof getDefaultPermissions>) => void) {
  const permissions = structuredClone(getDefaultPermissions(role));
  patch?.(permissions);
  auth.session = { user: { name: "Teste", username: "teste", role, permissions, sellerId: null } };
}

async function renderShell(at = 1280) {
  width = at;
  useProjectsStore.setState({ activeView: "table" });
  vi.mocked(api.apiListProjects).mockResolvedValue([project(1), project(2, { urgente: true, urgentDeadline: "2099-01-10", urgentReason: "x" })]);
  render(<ProjectsPageShell />);
  await waitFor(() => expect(useProjectsStore.getState().loadStatus).toBe("ready"));
}

/** Abre o ⋯ do projeto (linha da tabela ou card do celular) e devolve o item de urgência. */
async function urgencyItem(code: string, name: RegExp) {
  const text = await screen.findByText(code);
  const container = (text.closest("tr") ?? text.closest("article"))!;
  await userEvent.click(within(container as HTMLElement).getByRole("button", { name: "Abrir acoes do projeto" }));
  return screen.findByRole("menuitem", { name });
}

beforeEach(() => {
  installMatchMedia();
  window.sessionStorage.setItem("tsteck:reminders:alerted", "1");
  useProjectsStore.setState({
    projects: [],
    loadStatus: "idle",
    reminders: [],
    filters: { search: "", status: "all", construtora: "", obra: "", vendedor: "", equipamento: "", tipoCabineId: "", atrasadoOnly: false, urgenteOnly: false },
  });
  vi.mocked(api.apiSetUrgency).mockReset();
});
afterEach(() => cleanup());

describe("PROJECTS (sem projects.markUrgent) — ação de urgência indisponível", () => {
  it.each([1280, 390])("em %ipx: 'Marcar como urgente' desabilitado e sem efeito", async (at) => {
    login("PROJECTS");
    await renderShell(at);
    const item = await urgencyItem("CRE-000-0001", /Marcar como urgente/);
    expect(item).toHaveAttribute("data-disabled");
    await userEvent.click(item);
    expect(screen.queryByTestId("urgency-deadline-dialog")).not.toBeInTheDocument();
    expect(api.apiSetUrgency).not.toHaveBeenCalled();
  });

  it("'Remover urgencia' desabilitado e sem efeito", async () => {
    login("PROJECTS");
    await renderShell();
    const item = await urgencyItem("CRE-000-0002", /Remover urgencia/);
    expect(item).toHaveAttribute("data-disabled");
    await userEvent.click(item);
    expect(screen.queryByRole("dialog", { name: "Remover prioridade urgente?" })).not.toBeInTheDocument();
    expect(api.apiSetUrgency).not.toHaveBeenCalled();
  });

  it("as demais ações do PROJECTS seguem iguais (Editar e Alterar status habilitados)", async () => {
    login("PROJECTS");
    await renderShell();
    await urgencyItem("CRE-000-0001", /Marcar como urgente/);
    expect(screen.getByRole("menuitem", { name: /Editar projeto/ })).not.toHaveAttribute("data-disabled");
    expect(screen.getByRole("menuitem", { name: /Alterar status/ })).not.toHaveAttribute("data-disabled");
  });
});

describe("perfis com projects.markUrgent — ação disponível como antes", () => {
  it.each(["ADMIN", "MANAGER"] as UserRole[])("%s: marcar abre o diálogo de prazo", async (role) => {
    login(role);
    await renderShell();
    const item = await urgencyItem("CRE-000-0001", /Marcar como urgente/);
    expect(item).not.toHaveAttribute("data-disabled");
    await userEvent.click(item);
    expect(screen.getByTestId("urgency-deadline-dialog")).toBeInTheDocument();
  });

  it("ADMIN: remover abre a confirmação", async () => {
    login("ADMIN");
    await renderShell();
    await userEvent.click(await urgencyItem("CRE-000-0002", /Remover urgencia/));
    expect(screen.getByRole("dialog", { name: "Remover prioridade urgente?" })).toBeInTheDocument();
  });

  it("perfil personalizado com markUrgent concedido pelo admin: disponível", async () => {
    login("CUSTOM", (p) => {
      p.projects.edit = true;
      p.projects.markUrgent = true;
    });
    await renderShell();
    expect(await urgencyItem("CRE-000-0001", /Marcar como urgente/)).not.toHaveAttribute("data-disabled");
  });

  it("MANAGER sem markUrgent (retirado pelo admin): indisponível", async () => {
    login("MANAGER", (p) => {
      p.projects.markUrgent = false;
    });
    await renderShell();
    expect(await urgencyItem("CRE-000-0001", /Marcar como urgente/)).toHaveAttribute("data-disabled");
  });
});
