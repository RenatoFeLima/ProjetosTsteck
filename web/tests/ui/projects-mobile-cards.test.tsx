import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { Project } from "@/features/projects/domain/project-types";
import type { ProjectReminder } from "@/features/projects/domain/project-reminders";

// Fase 3: projetos em cards no celular (< 768px). Mesma fonte, mesma ordem e
// mesma paginação da tabela — só a apresentação muda.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
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

import { ProjectsTable } from "@/features/projects/components/projects-table";
import { ProjectsPageShell } from "@/features/projects/components/projects-page-shell";
import { useProjectsStore } from "@/features/projects/state/projects-store";
import * as api from "@/features/projects/lib/projects-api";
import * as remindersApi from "@/features/projects/lib/reminders-api";

// ── matchMedia controlável (mesmo padrão do teste do shell) ──────────────────
let width = 1280;
const listeners = new Set<() => void>();
function installMatchMedia() {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    return {
      media: query,
      get matches() { return min ? width >= Number(min[1]) : false; },
      onchange: null,
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
      addListener: (cb: () => void) => listeners.add(cb),
      removeListener: (cb: () => void) => listeners.delete(cb),
      dispatchEvent: () => true,
    };
  }) as unknown as typeof window.matchMedia;
}
function resizeTo(next: number) {
  act(() => {
    width = next;
    listeners.forEach((cb) => cb());
  });
}

function makeProject(n: number, overrides: Partial<Project> = {}): Project {
  const code = `CRE-000-${String(n).padStart(4, "0")}`;
  return {
    id: `p${n}`,
    construtora: `CONSTRUTORA ${n}`,
    obra: `OBRA ${n}`,
    unidade_obra: `BLOCO ${n}`,
    equipamento: "EK-15/26",
    codigo_projeto: code,
    vendedor: `VENDEDOR ${n}`,
    proj_obra_recebido: true,
    local_cabine_definido: true,
    alinhamento: true,
    data_lancamento: "2026-05-01",
    data_alinhamento: "2026-05-02",
    status_atual: "CADASTRO INICIAL",
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

// 13 projetos, fora de ordem, para ordenação e paginação (pageSize padrão = 12).
const MANY = [7, 2, 13, 5, 11, 1, 9, 3, 12, 4, 10, 6, 8].map((n) => makeProject(n));

const cardCodes = () =>
  screen.getAllByRole("button", { name: /^Abrir projeto / }).map((b) => b.textContent);
const tableCodes = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((row) => /CRE-\d{3}-\d{4}/.exec(row.textContent ?? "")?.[0]);

function renderTable(at: number, projects: Project[] = MANY, props: Partial<Parameters<typeof ProjectsTable>[0]> = {}) {
  width = at;
  const handlers = {
    onViewDetails: vi.fn(),
    onEditProject: vi.fn(),
    onChangeStatus: vi.fn(),
    onViewHistory: vi.fn(),
    onMarkUrgente: vi.fn(),
    onRemoveUrgente: vi.fn(),
    onClearFilters: vi.fn(),
    onRetry: vi.fn(),
  };
  const view = render(<ProjectsTable projects={projects} {...handlers} {...props} />);
  return { ...view, handlers };
}

beforeEach(() => {
  listeners.clear();
  installMatchMedia();
  window.sessionStorage.clear();
  vi.mocked(api.apiListProjects).mockReset();
  vi.mocked(remindersApi.apiListReminders).mockReset().mockResolvedValue([]);
  useProjectsStore.setState({
    projects: [],
    loadStatus: "idle",
    activeView: "table",
    reminders: [],
    filters: {
      search: "", status: "all", construtora: "", obra: "", vendedor: "", equipamento: "",
      tipoCabineId: "", atrasadoOnly: false, urgenteOnly: false,
    },
  });
});

afterEach(() => cleanup());

describe("apresentação por faixa de tela", () => {
  it("< 768px: cards, sem tabela", () => {
    renderTable(390);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Projetos" })).toBeInTheDocument();
    expect(cardCodes()).toHaveLength(12);
  });

  it("≥ 768px: tabela, sem cards", () => {
    renderTable(768);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Projetos" })).not.toBeInTheDocument();
  });

  it("cards e tabela mostram os mesmos projetos na mesma ordem", () => {
    renderTable(1280);
    const fromTable = tableCodes();
    resizeTo(390);
    expect(cardCodes()).toEqual(fromTable);
    expect(cardCodes()[0]).toBe("CRE-000-0001");
  });

  it("ordenação feita no tablet é mantida ao reduzir para o celular", async () => {
    renderTable(820);
    await userEvent.click(screen.getByRole("button", { name: /CODIGO/ })); // asc → desc
    const fromTable = tableCodes();
    expect(fromTable[0]).toBe("CRE-000-0013");
    resizeTo(390);
    expect(cardCodes()).toEqual(fromTable);
  });
});

describe("paginação compartilhada", () => {
  it("próxima página mostra os cards seguintes", async () => {
    renderTable(390);
    expect(screen.getByText("Exibindo 1-12 de 13 registros")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Proxima pagina" }));
    expect(cardCodes()).toEqual(["CRE-000-0013"]);
    expect(screen.getByText("2/2")).toBeInTheDocument();
  });

  it("itens por página muda a quantidade de cards e volta à página 1", async () => {
    renderTable(390);
    await userEvent.click(screen.getByRole("button", { name: "Proxima pagina" }));
    await userEvent.selectOptions(screen.getByRole("combobox"), "10");
    expect(cardCodes()).toHaveLength(10);
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("767 → 768 → 767 preserva página, ordenação e itens por página", async () => {
    renderTable(767);
    await userEvent.selectOptions(screen.getByRole("combobox"), "10");
    await userEvent.click(screen.getByRole("button", { name: "Proxima pagina" }));
    const cardsPage2 = cardCodes();
    resizeTo(768);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(tableCodes()).toEqual(cardsPage2);
    expect(screen.getByText("2/2")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("10");
    resizeTo(767);
    expect(cardCodes()).toEqual(cardsPage2);
  });

  it("controles da paginação com alvo de 44px só em toque", () => {
    renderTable(390);
    for (const name of ["Pagina anterior", "Proxima pagina"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("p-2", "pointer-coarse:h-11", "pointer-coarse:w-11");
    }
    expect(screen.getByRole("combobox")).toHaveClass("h-9", "pointer-coarse:h-11");
  });
});

describe("estados (mesmos da Fase 1)", () => {
  it("loading: skeletons de card, sem vazio falso", () => {
    renderTable(390, [], { state: "loading" });
    expect(screen.getByRole("status")).toHaveTextContent("Carregando projetos...");
    expect(screen.queryByText(/Nenhum projeto/)).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Projetos" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("vazio real: mesma mensagem e 'Limpar filtros'", async () => {
    const { handlers } = renderTable(390, [], { state: "ready" });
    expect(screen.getByText("Nenhum projeto corresponde aos filtros aplicados.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(handlers.onClearFilters).toHaveBeenCalled();
  });

  it("erro: mesma mensagem e retry", async () => {
    const { handlers } = renderTable(390, [], { state: "error" });
    expect(screen.getByText("Nao foi possivel carregar os projetos.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Tentar novamente/ }));
    expect(handlers.onRetry).toHaveBeenCalled();
  });
});

describe("card: abertura, menu e permissões", () => {
  it("o card abre os detalhes pelo mesmo onViewDetails", async () => {
    const { handlers } = renderTable(390);
    await userEvent.click(screen.getByRole("button", { name: "Abrir projeto CRE-000-0001" }));
    expect(handlers.onViewDetails).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }));
  });

  it("a camada clicável cobre o card e não encolhe no toque (sem transform no :active)", () => {
    renderTable(390);
    const open = screen.getByRole("button", { name: "Abrir projeto CRE-000-0001" });
    expect(open).toHaveClass("after:absolute", "after:inset-0", "active:transform-none!");
    // Nenhum botão aninhado: o ⋯ é irmão, fora do botão principal.
    expect(open.querySelector("button")).toBeNull();
  });

  it("Enter e Espaço abrem os detalhes", async () => {
    const { handlers } = renderTable(390);
    screen.getByRole("button", { name: "Abrir projeto CRE-000-0001" }).focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard(" ");
    expect(handlers.onViewDetails).toHaveBeenCalledTimes(2);
  });

  it("⋯ abre o menu e NÃO abre o projeto; alvo de 44px", async () => {
    const { handlers } = renderTable(390);
    const trigger = within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: "Abrir acoes do projeto" });
    expect(trigger).toHaveClass("h-11", "w-11");
    await userEvent.click(trigger);
    expect(await screen.findByRole("menuitem", { name: /Ver detalhes/ })).toBeInTheDocument();
    expect(handlers.onViewDetails).not.toHaveBeenCalled();
  });

  it("ações do menu chamam os mesmos handlers da tabela", async () => {
    const { handlers } = renderTable(390);
    const openMenu = async () =>
      userEvent.click(within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: "Abrir acoes do projeto" }));
    const cases: Array<[RegExp, keyof typeof handlers]> = [
      [/Ver detalhes/, "onViewDetails"],
      [/Editar projeto/, "onEditProject"],
      [/Alterar status/, "onChangeStatus"],
      [/Marcar como urgente/, "onMarkUrgente"],
      [/Ver historico/, "onViewHistory"],
    ];
    for (const [name, handler] of cases) {
      await openMenu();
      await userEvent.click(await screen.findByRole("menuitem", { name }));
      expect(handlers[handler]).toHaveBeenLastCalledWith(expect.objectContaining({ id: "p1" }));
    }
  });

  it("remover urgência passa pela mesma confirmação", async () => {
    const urgent = makeProject(1, { urgente: true, urgentDeadline: "2099-01-10" });
    const { handlers } = renderTable(390, [urgent]);
    await userEvent.click(screen.getByRole("button", { name: "Abrir acoes do projeto" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Remover urgencia/ }));
    expect(handlers.onRemoveUrgente).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Remover prioridade urgente?");
    await userEvent.click(within(dialog).getByRole("button", { name: "Remover urgencia" }));
    expect(handlers.onRemoveUrgente).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }));
  });

  it("sem permissão (handler ausente) o item fica desabilitado, como na tabela", async () => {
    renderTable(390, MANY, { onEditProject: undefined, onChangeStatus: undefined, onMarkUrgente: undefined });
    await userEvent.click(within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: "Abrir acoes do projeto" }));
    for (const name of [/Editar projeto/, /Alterar status/, /Marcar como urgente/]) {
      expect(await screen.findByRole("menuitem", { name })).toHaveAttribute("data-disabled");
    }
    expect(screen.getByRole("menuitem", { name: /Ver detalhes/ })).not.toHaveAttribute("data-disabled");
  });

  it("mostra status, urgência e prazo com os badges existentes", () => {
    const overdue = makeProject(1, { status_atual: "ELABORAR ANTE-PROJETO", status_entered_at: "2020-01-01" });
    const urgent = makeProject(2, { status_atual: "ELABORAR ANTE-PROJETO", urgente: true, urgentDeadline: "2099-01-10" });
    renderTable(390, [overdue, urgent]);
    const [first, second] = screen.getAllByRole("listitem");
    expect(within(first).getByText("Elaborar Ante-Projeto")).toBeInTheDocument();
    expect(within(first).getByText("Prazo:")).toBeInTheDocument();
    expect(within(first).getByText(/atraso/)).toBeInTheDocument();
    // Urgente: urgência no lugar do prazo operacional (mesma regra do DeadlineBadge).
    expect(within(second).getByText(/^Urgente/)).toBeInTheDocument();
    expect(within(second).queryByText("Prazo:")).not.toBeInTheDocument();
    expect(within(first).getByText("VENDEDOR 1")).toBeInTheDocument();
  });
});

describe("pela tela de Projetos (store real, sem nova pipeline)", () => {
  const P = {
    a: makeProject(1, { construtora: "ALFA", obra: "OBRA A", vendedor: "ANA", equipamento: "EQ-1", tipo_cabine_id: "tc1", status_atual: "ELABORAR ANTE-PROJETO", status_entered_at: "2020-01-01" }),
    b: makeProject(2, { construtora: "BETA", obra: "OBRA B", vendedor: "BIA", equipamento: "EQ-2", tipo_cabine_id: "tc2", urgente: true, urgentDeadline: "2099-01-10" }),
    c: makeProject(3, { construtora: "GAMA", obra: "OBRA C", vendedor: "CAIO", equipamento: "EQ-3", tipo_cabine_id: "tc3", status_atual: "ANTE-PROJETO ENVIADO" }),
  };

  async function renderShellAt(at: number) {
    width = at;
    vi.mocked(api.apiListProjects).mockResolvedValue([P.a, P.b, P.c]);
    render(<ProjectsPageShell />);
    await waitFor(() => expect(cardCodes()).toHaveLength(3));
  }

  it("busca e cada filtro existente refletem nos cards", async () => {
    await renderShellAt(390);
    const cases: Array<[Parameters<ReturnType<typeof useProjectsStore.getState>["setFilters"]>[0], string[]]> = [
      [{ search: "beta" }, ["CRE-000-0002"]],
      [{ status: "ANTE-PROJETO ENVIADO" }, ["CRE-000-0003"]],
      [{ construtora: "ALFA" }, ["CRE-000-0001"]],
      [{ obra: "OBRA C" }, ["CRE-000-0003"]],
      [{ vendedor: "BIA" }, ["CRE-000-0002"]],
      [{ equipamento: "EQ-3" }, ["CRE-000-0003"]],
      [{ tipoCabineId: "tc1" }, ["CRE-000-0001"]],
      [{ atrasadoOnly: true }, ["CRE-000-0001"]],
      [{ urgenteOnly: true }, ["CRE-000-0002"]],
    ];
    const reset = {
      search: "", status: "all" as const, construtora: "", obra: "", vendedor: "", equipamento: "",
      tipoCabineId: "", atrasadoOnly: false, urgenteOnly: false,
    };
    for (const [patch, expected] of cases) {
      act(() => useProjectsStore.getState().setFilters({ ...reset, ...patch }));
      expect(cardCodes()).toEqual(expected);
    }
  });

  it("a busca digitada na toolbar filtra os cards", async () => {
    await renderShellAt(390);
    await userEvent.type(screen.getByRole("textbox", { name: /Buscar por codigo/ }), "gama");
    expect(cardCodes()).toEqual(["CRE-000-0003"]);
  });

  it("767 → 768 → 767 troca a apresentação sem nova chamada a /api/projects", async () => {
    await renderShellAt(767);
    const calls = vi.mocked(api.apiListProjects).mock.calls.length;
    resizeTo(768);
    expect(screen.getByRole("table")).toBeInTheDocument();
    resizeTo(767);
    expect(cardCodes()).toHaveLength(3);
    expect(vi.mocked(api.apiListProjects).mock.calls.length).toBe(calls);
  });

  it("recarga em segundo plano mantém os cards na tela", async () => {
    await renderShellAt(390);
    let resolve!: (v: Project[]) => void;
    vi.mocked(api.apiListProjects).mockReturnValue(new Promise((r) => { resolve = r; }));
    const pending = useProjectsStore.getState().hydrate();
    expect(cardCodes()).toHaveLength(3);
    expect(screen.queryByText("Carregando projetos...")).not.toBeInTheDocument();
    await act(async () => { resolve([P.a, P.b, P.c]); await pending; });
    expect(cardCodes()).toHaveLength(3);
  });

  it("lembrete aparece no card com os dados já carregados, sem nova request", async () => {
    const reminder: ProjectReminder = {
      id: "r1", projeto_id: "p3", descricao: "Conferir planta com o cliente", prioridade: "NORMAL", status: "PENDENTE",
      data_inicial: "2099-01-01", proxima_data: "2099-01-01", recorrencia_dias: 7, criado_por: "Renato",
      criado_em: "2099-01-01T10:00:00.000Z", atualizado_em: "2099-01-01T10:00:00.000Z",
    };
    vi.mocked(remindersApi.apiListReminders).mockResolvedValue([reminder]);
    await renderShellAt(390);
    await waitFor(() => expect(screen.getByTitle(/Conferir planta com o cliente/)).toBeInTheDocument());
    const cardC = screen.getAllByRole("listitem")[2];
    expect(within(cardC).getByTitle(/Conferir planta com o cliente/)).toBeInTheDocument();
    const calls = vi.mocked(remindersApi.apiListReminders).mock.calls.length;
    resizeTo(768);
    resizeTo(390);
    expect(within(screen.getAllByRole("listitem")[2]).getByTitle(/Conferir planta com o cliente/)).toBeInTheDocument();
    expect(vi.mocked(remindersApi.apiListReminders).mock.calls.length).toBe(calls);
  });
});
