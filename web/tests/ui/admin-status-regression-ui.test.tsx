import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { UserRole } from "@/features/auth/lib/auth-types";
import type { Project, StatusHistoryItem } from "@/features/projects/domain/project-types";

// Regressão administrativa na interface: só ADMIN vê a ação (menu ⋯ e drawer);
// modal em duas etapas; nada muda antes da resposta do servidor; erro mantém
// o projeto e o modal como estavam.

const auth = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("@/features/auth/hooks/use-auth", () => ({ useAuth: () => ({ session: auth.session, isLoading: false }) }));
vi.mock("@/features/projects/lib/projects-api", async (orig) => ({
  ...(await orig<typeof import("@/features/projects/lib/projects-api")>()),
  apiListProjects: vi.fn(async () => []),
  apiRegressStatus: vi.fn(),
  apiChangeStatus: vi.fn(),
  apiGetHistory: vi.fn(async () => ({ statusHistory: [], observations: [], reviewStudyHistory: [], finalReviewHistory: [] })),
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
import { ProjectDetailsDrawer } from "@/features/projects/components/project-details-drawer";
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
    status_atual: "PROJETO APROVADO",
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
const APPROVED = project(1);
const INITIAL = project(2, { status_atual: "CADASTRO INICIAL" });

function login(role: UserRole, patch?: (p: ReturnType<typeof getDefaultPermissions>) => void) {
  const permissions = structuredClone(getDefaultPermissions(role));
  patch?.(permissions);
  auth.session = { user: { name: "Teste", username: "teste", role, permissions, sellerId: role === "SELLER" ? "s1" : null } };
}

async function renderShell(at = 1280) {
  width = at;
  useProjectsStore.setState({ activeView: "table" });
  vi.mocked(api.apiListProjects).mockResolvedValue([APPROVED, INITIAL]);
  render(<ProjectsPageShell />);
  await waitFor(() => expect(useProjectsStore.getState().loadStatus).toBe("ready"));
}

/** Abre o ⋯ do projeto (linha da tabela ou card do celular). */
async function openMenu(code: string) {
  const text = await screen.findByText(code);
  const container = (text.closest("tr") ?? text.closest("article"))!;
  await userEvent.click(within(container as HTMLElement).getByRole("button", { name: "Abrir acoes do projeto" }));
  await screen.findByRole("menuitem", { name: /Ver detalhes/ });
}

const dialog = () => screen.getByTestId("admin-status-regression-dialog");
const REASON = "Cliente solicitou revisão do ante-projeto após aprovação.";

async function openRegressionFromMenu(code = APPROVED.codigo_projeto) {
  await openMenu(code);
  await userEvent.click(screen.getByRole("menuitem", { name: /Regredir status/ }));
  return dialog();
}

async function fillAndContinue(target: string, reason = REASON) {
  await userEvent.selectOptions(within(dialog()).getByRole("combobox"), target);
  await userEvent.type(within(dialog()).getByRole("textbox"), reason);
  await userEvent.click(within(dialog()).getByRole("button", { name: "Continuar" }));
}

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
  installMatchMedia();
  window.sessionStorage.setItem("tsteck:reminders:alerted", "1");
  useProjectsStore.setState({
    projects: [],
    loadStatus: "idle",
    reminders: [],
    statusHistory: [],
    observations: [],
    filters: { search: "", status: "all", construtora: "", obra: "", vendedor: "", equipamento: "", tipoCabineId: "", atrasadoOnly: false, urgenteOnly: false },
  });
  vi.mocked(api.apiRegressStatus).mockReset();
  vi.mocked(api.apiChangeStatus).mockReset();
  vi.mocked(api.apiGetHistory).mockClear();
});
afterEach(() => cleanup());

// ─── Visibilidade ───────────────────────────────────────────────────────────────

describe("ADMIN — ação visível", () => {
  it.each([1280, 390])("em %ipx: 'Regredir status' no menu ⋯", async (at) => {
    login("ADMIN");
    await renderShell(at);
    await openMenu(APPROVED.codigo_projeto);
    expect(screen.getByRole("menuitem", { name: /Regredir status/ })).not.toHaveAttribute("data-disabled");
  });

  it("Cadastro Inicial não tem etapa anterior: item desabilitado e sem efeito", async () => {
    login("ADMIN");
    await renderShell();
    await openMenu(INITIAL.codigo_projeto);
    const item = screen.getByRole("menuitem", { name: /Regredir status/ });
    expect(item).toHaveAttribute("data-disabled");
    await userEvent.click(item);
    expect(screen.queryByTestId("admin-status-regression-dialog")).not.toBeInTheDocument();
  });

  it("drawer de detalhes: botão 'Regredir status' ao lado de 'Editar projeto'", async () => {
    login("ADMIN");
    await renderShell();
    await openMenu(APPROVED.codigo_projeto);
    await userEvent.click(screen.getByRole("menuitem", { name: /Ver detalhes/ }));
    const drawer = await screen.findByRole("dialog", { name: /Painel operacional/ });
    expect(within(drawer).getByRole("button", { name: /Editar projeto/ })).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole("button", { name: /Regredir status/ }));
    expect(dialog()).toBeInTheDocument();
  });
});

describe("não ADMIN — nenhum item, nenhum botão", () => {
  it.each([
    ["PROJECTS", () => login("PROJECTS")],
    ["MANAGER", () => login("MANAGER")],
    ["CUSTOM com changeStatus", () => login("CUSTOM", (p) => { p.projects.edit = true; p.projects.changeStatus = true; })],
    ["SELLER", () => login("SELLER")],
    ["COMMERCIAL", () => login("COMMERCIAL")],
    ["VIEWER", () => login("VIEWER")],
  ])("%s", async (_label, doLogin) => {
    doLogin();
    await renderShell();
    await openMenu(APPROVED.codigo_projeto);
    expect(screen.queryByRole("menuitem", { name: /Regredir status/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: /Ver detalhes/ }));
    const drawer = await screen.findByRole("dialog", { name: /Painel operacional/ });
    expect(within(drawer).queryByRole("button", { name: /Regredir status/ })).not.toBeInTheDocument();
  });
});

// ─── Modal ──────────────────────────────────────────────────────────────────────

describe("modal — destinos, motivo e confirmação", () => {
  it("lista só as etapas anteriores (sem o status atual, sem futuro, sem revisão)", async () => {
    login("ADMIN");
    await renderShell();
    await openRegressionFromMenu();
    const options = within(dialog())
      .getAllByRole("option")
      .map((o) => o.getAttribute("value"))
      .filter(Boolean);
    expect(options).toEqual(["CADASTRO INICIAL", "ELABORAR ANTE-PROJETO", "ANTE-PROJETO ENVIADO", "ANTE-PROJETO APROVADO", "PROJETO FINAL ENVIADO"]);
  });

  it("motivo obrigatório: Continuar bloqueado sem destino ou com menos de 5 caracteres", async () => {
    login("ADMIN");
    await renderShell();
    await openRegressionFromMenu();
    const continuar = within(dialog()).getByRole("button", { name: "Continuar" });
    expect(continuar).toBeDisabled();
    await userEvent.selectOptions(within(dialog()).getByRole("combobox"), "ANTE-PROJETO ENVIADO");
    await userEvent.type(within(dialog()).getByRole("textbox"), "   abcd   ");
    expect(continuar).toBeDisabled();
    await userEvent.type(within(dialog()).getByRole("textbox"), "e");
    expect(continuar).toBeEnabled();
  });

  it("avisos: Cadastro Inicial (alinhamento pendente) e destino com SLA (prazo recontado)", async () => {
    login("ADMIN");
    await renderShell();
    await openRegressionFromMenu();
    await userEvent.selectOptions(within(dialog()).getByRole("combobox"), "CADASTRO INICIAL");
    expect(within(dialog()).getByText(/O alinhamento será marcado como pendente novamente/)).toBeInTheDocument();
    expect(within(dialog()).queryByText(/prazo desta etapa será contado novamente/)).not.toBeInTheDocument();
    await userEvent.selectOptions(within(dialog()).getByRole("combobox"), "ELABORAR ANTE-PROJETO");
    expect(within(dialog()).getByText(/prazo desta etapa será contado novamente/)).toBeInTheDocument();
    expect(within(dialog()).queryByText(/alinhamento será marcado/)).not.toBeInTheDocument();
  });

  it("Continuar NÃO executa: mostra a confirmação com De/Para/motivo; Voltar preserva o preenchido", async () => {
    login("ADMIN");
    await renderShell();
    await openRegressionFromMenu();
    await fillAndContinue("ANTE-PROJETO ENVIADO");
    expect(api.apiRegressStatus).not.toHaveBeenCalled();
    expect(within(dialog()).getByRole("heading", { name: "Confirmar regressão de status?" })).toBeInTheDocument();
    const summary = within(dialog()).getByTestId("admin-regression-summary");
    expect(summary).toHaveTextContent("De: PROJETO APROVADO");
    expect(summary).toHaveTextContent("Para: ANTE-PROJETO ENVIADO");
    expect(within(dialog()).getByText(REASON)).toBeInTheDocument();
    expect(within(dialog()).getByText("Esta ação será registrada no histórico e na auditoria.")).toBeInTheDocument();

    await userEvent.click(within(dialog()).getByRole("button", { name: "Voltar" }));
    expect(within(dialog()).getByRole("combobox")).toHaveValue("ANTE-PROJETO ENVIADO");
    expect(within(dialog()).getByRole("textbox")).toHaveValue(REASON);
  });

  it("Cancelar fecha sem chamar a API", async () => {
    login("ADMIN");
    await renderShell();
    await openRegressionFromMenu();
    await fillAndContinue("ANTE-PROJETO ENVIADO");
    await userEvent.click(within(dialog()).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByTestId("admin-status-regression-dialog")).not.toBeInTheDocument();
    expect(api.apiRegressStatus).not.toHaveBeenCalled();
  });
});

// ─── Envio ──────────────────────────────────────────────────────────────────────

describe("envio", () => {
  it("sucesso: uma chamada, projeto trocado pela resposta, histórico recarregado, modal fechado", async () => {
    login("ADMIN");
    await renderShell();
    const regressed = { ...APPROVED, status_atual: "ANTE-PROJETO ENVIADO" as const, status_entered_at: "2026-09-30T10:00:00.000Z" };
    vi.mocked(api.apiRegressStatus).mockResolvedValue(regressed);
    await openRegressionFromMenu();
    await fillAndContinue("ANTE-PROJETO ENVIADO", `  ${REASON}  `);
    vi.mocked(api.apiGetHistory).mockClear();
    await userEvent.click(within(dialog()).getByRole("button", { name: "Sim, regredir status" }));

    await waitFor(() => expect(screen.queryByTestId("admin-status-regression-dialog")).not.toBeInTheDocument());
    expect(api.apiRegressStatus).toHaveBeenCalledTimes(1);
    expect(api.apiRegressStatus).toHaveBeenCalledWith("p1", "ANTE-PROJETO ENVIADO", REASON);
    expect(api.apiChangeStatus).not.toHaveBeenCalled(); // não passa pelo fluxo normal
    expect(useProjectsStore.getState().projects.find((p) => p.id === "p1")).toEqual(regressed);
    expect(api.apiGetHistory).toHaveBeenCalledWith("p1");
    expect(screen.getByText("Status regredido para ANTE-PROJETO ENVIADO.")).toBeInTheDocument();
  });

  it("duplo clique / Esc durante o envio: uma única chamada, modal travado com 'Regredindo...'", async () => {
    login("ADMIN");
    await renderShell();
    const pending = deferred<Project>();
    vi.mocked(api.apiRegressStatus).mockReturnValue(pending.promise);
    await openRegressionFromMenu();
    await fillAndContinue("ANTE-PROJETO ENVIADO");
    const confirmar = within(dialog()).getByRole("button", { name: "Sim, regredir status" });
    fireEvent.click(confirmar);
    fireEvent.click(confirmar);
    fireEvent.click(confirmar);
    expect(api.apiRegressStatus).toHaveBeenCalledTimes(1);
    expect(within(dialog()).getByRole("button", { name: "Regredindo..." })).toBeDisabled();
    expect(within(dialog()).getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(within(dialog()).getByRole("button", { name: "Voltar" })).toBeDisabled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(dialog()).toBeInTheDocument();
    // Nada muda na tela antes da resposta.
    expect(useProjectsStore.getState().projects.find((p) => p.id === "p1")!.status_atual).toBe("PROJETO APROVADO");

    await act(async () => pending.resolve({ ...APPROVED, status_atual: "ANTE-PROJETO ENVIADO" }));
    await waitFor(() => expect(screen.queryByTestId("admin-status-regression-dialog")).not.toBeInTheDocument());
    expect(api.apiRegressStatus).toHaveBeenCalledTimes(1);
  });

  it("falha da API: projeto intacto, modal aberto com a mensagem, pode tentar de novo", async () => {
    login("ADMIN");
    await renderShell();
    vi.mocked(api.apiRegressStatus).mockRejectedValueOnce(new Error("O status do projeto foi alterado por outra operação."));
    await openRegressionFromMenu();
    await fillAndContinue("ANTE-PROJETO ENVIADO");
    const before = structuredClone(useProjectsStore.getState().projects);
    await userEvent.click(within(dialog()).getByRole("button", { name: "Sim, regredir status" }));

    const alert = await within(dialog()).findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível regredir o status do projeto. Nenhuma alteração foi realizada. Tente novamente.");
    expect(alert).toHaveTextContent("O status do projeto foi alterado por outra operação.");
    expect(useProjectsStore.getState().projects).toEqual(before);
    expect(within(dialog()).getByRole("button", { name: "Sim, regredir status" })).toBeEnabled();

    vi.mocked(api.apiRegressStatus).mockResolvedValueOnce({ ...APPROVED, status_atual: "ANTE-PROJETO ENVIADO" });
    await userEvent.click(within(dialog()).getByRole("button", { name: "Sim, regredir status" }));
    await waitFor(() => expect(screen.queryByTestId("admin-status-regression-dialog")).not.toBeInTheDocument());
    expect(api.apiRegressStatus).toHaveBeenCalledTimes(2);
  });

  it("pelo drawer: Esc fecha só o modal (o drawer continua aberto)", async () => {
    login("ADMIN");
    await renderShell();
    await openMenu(APPROVED.codigo_projeto);
    await userEvent.click(screen.getByRole("menuitem", { name: /Ver detalhes/ }));
    const drawer = await screen.findByRole("dialog", { name: /Painel operacional/ });
    await userEvent.click(within(drawer).getByRole("button", { name: /Regredir status/ }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("admin-status-regression-dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /Painel operacional/ })).toBeInTheDocument();
  });
});

// ─── Histórico ──────────────────────────────────────────────────────────────────

describe("histórico do drawer", () => {
  it("evento admin_regression aparece como 'Regressão administrativa' com o motivo", () => {
    const history: StatusHistoryItem[] = [
      { id: "h1", projeto_id: "p1", status_de: "ANTE-PROJETO ENVIADO", status_para: "ANTE-PROJETO APROVADO", alterado_em: "2026-05-01T10:00:00.000Z", origem: "kanban" },
      {
        id: "h2",
        projeto_id: "p1",
        status_de: "PROJETO APROVADO",
        status_para: "ANTE-PROJETO ENVIADO",
        alterado_em: "2026-09-30T10:00:00.000Z",
        origem: "admin_regression",
        nota: REASON,
      },
    ];
    render(
      <ProjectDetailsDrawer
        open
        project={APPROVED}
        initialSection="history"
        statusHistory={history}
        observations={[]}
        onClose={vi.fn()}
        onUpdate={vi.fn(() => Promise.resolve({ ok: true }))}
        isCodigoDuplicado={vi.fn(() => false)}
        onAddObservation={vi.fn()}
        notify={vi.fn()}
      />,
    );
    expect(screen.getByText("Regressão administrativa")).toBeInTheDocument();
    expect(screen.getByText(`PROJETO APROVADO -> ANTE-PROJETO ENVIADO. Motivo: ${REASON}`)).toBeInTheDocument();
    expect(screen.getByText("ANTE-PROJETO ENVIADO -> ANTE-PROJETO APROVADO (kanban)")).toBeInTheDocument();
  });
});
