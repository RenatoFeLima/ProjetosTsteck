import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { Project, ProjectStatus } from "@/features/projects/domain/project-types";

// Fase 6: Kanban no celular (uma etapa por vez, "Mover para" no ⋯) e fallback
// de toque no Kanban de mesa. Arraste e menu convergem no MESMO requestMove →
// mesmos diálogos → onMoveStatus → store.moveStatus.

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
  apiChangeStatus: vi.fn(),
  apiAddObservation: vi.fn(async () => ({})),
  apiGetNextCodeSuggestion: vi.fn(async () => {
    throw new Error("sem sugestão no teste");
  }),
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

vi.mock("@/features/projects/services/project-notification-service", () => ({
  sendProjectNotification: vi.fn(async () => ({ ok: true, message: "ok" })),
}));

import { ProjectsKanban } from "@/features/projects/components/projects-kanban";
import { ProjectsPageShell } from "@/features/projects/components/projects-page-shell";
import { useProjectsStore } from "@/features/projects/state/projects-store";
import * as api from "@/features/projects/lib/projects-api";

// ── matchMedia controlável (mesmo padrão das Fases 3–5) ──────────────────────
let width = 1280;
const mqListeners = new Set<() => void>();
function installMatchMedia() {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    return {
      media: query,
      get matches() {
        return min ? width >= Number(min[1]) : false;
      },
      onchange: null,
      addEventListener: (_: string, cb: () => void) => mqListeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => mqListeners.delete(cb),
      addListener: (cb: () => void) => mqListeners.add(cb),
      removeListener: (cb: () => void) => mqListeners.delete(cb),
      dispatchEvent: () => true,
    };
  }) as unknown as typeof window.matchMedia;
}
// Como no navegador: o "resize" da janela chega antes da troca de media query
// (o dnd-kit cancela um arraste em andamento nesse evento).
function resizeTo(next: number) {
  act(() => {
    width = next;
    window.dispatchEvent(new Event("resize"));
    mqListeners.forEach((cb) => cb());
  });
}

// Ordem visual do Kanban de mesa e rótulos exibidos.
const STAGES: Array<[ProjectStatus, string]> = [
  ["CADASTRO INICIAL", "Cadastro Inicial"],
  ["ELABORAR ANTE-PROJETO", "Elaborar Ante-Projeto"],
  ["ANTE-PROJETO ENVIADO", "Ante-Projeto Enviado"],
  ["ANTE-PROJETO APROVADO", "Ante-Projeto Aprovado"],
  ["PROJETO FINAL ENVIADO", "Projeto Final Enviado"],
  ["PROJETO APROVADO", "Projeto Aprovado"],
  ["REVISAO DE ESTUDO", "Revisão de Estudo"],
  ["REVISAO DE PROJETO FINAL", "Revisão de Projeto Final"],
];

function makeProject(n: number, overrides: Partial<Project> = {}): Project {
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

// Distribuição: Cadastro 0, Elaborar 3, AP Enviado 2, AP Aprovado 1, PF Enviado 1,
// Projeto Aprovado 2, Rev. Estudo 1, Rev. PF 0.
const DIST: Array<[ProjectStatus, number]> = [
  ["ELABORAR ANTE-PROJETO", 3],
  ["ANTE-PROJETO ENVIADO", 2],
  ["ANTE-PROJETO APROVADO", 1],
  ["PROJETO FINAL ENVIADO", 1],
  ["PROJETO APROVADO", 2],
  ["REVISAO DE ESTUDO", 1],
];
function mixedProjects(): Project[] {
  let n = 0;
  return DIST.flatMap(([status, q]) => Array.from({ length: q }, () => makeProject(++n, { status_atual: status })));
}
const COUNTS: Record<ProjectStatus, number> = {
  "CADASTRO INICIAL": 0,
  "ELABORAR ANTE-PROJETO": 3,
  "ANTE-PROJETO ENVIADO": 2,
  "ANTE-PROJETO APROVADO": 1,
  "PROJETO FINAL ENVIADO": 1,
  "PROJETO APROVADO": 2,
  "REVISAO DE ESTUDO": 1,
  "REVISAO DE PROJETO FINAL": 0,
};

type KanbanProps = Parameters<typeof ProjectsKanban>[0];
function renderKanban(at: number, projects: Project[], props: Partial<KanbanProps> = {}) {
  width = at;
  const handlers = {
    onMoveStatus: vi.fn<KanbanProps["onMoveStatus"]>(() => ({ ok: true })),
    onOpen: vi.fn(),
    notify: vi.fn(),
    isCodigoDuplicado: vi.fn(() => false),
    onCreateReminder: vi.fn(),
    onClearFilters: vi.fn(),
  };
  const view = render(<ProjectsKanban projects={projects} canDrag {...handlers} {...props} />);
  return { ...view, handlers };
}

const stageRegions = () => screen.queryAllByRole("region", { name: /^Etapa / });
const activeStage = () => stageRegions()[0]?.getAttribute("aria-label")?.replace(/^Etapa /, "");
const cardCodes = () => screen.queryAllByRole("button", { name: /^Abrir projeto / }).map((b) => b.textContent);
const draggables = () => document.querySelectorAll('[aria-roledescription="draggable"]');
const stageTrigger = () => screen.getByRole("button", { name: /^Etapa: / });

async function openCardMenu(code: string) {
  await userEvent.click(screen.getByRole("button", { name: `Abrir ações de ${code}` }));
  return screen.findByRole("menu");
}
async function moveViaMenu(code: string, destLabel: string) {
  await openCardMenu(code);
  await userEvent.click(screen.getByRole("menuitem", { name: `Mover para ${destLabel}` }));
}

beforeEach(() => {
  installMatchMedia();
  mqListeners.clear();
  width = 1280;
  window.localStorage.clear();
  window.sessionStorage.setItem("tsteck:reminders:alerted", "1");
  useProjectsStore.setState({
    projects: [],
    loadStatus: "idle",
    reminders: [],
    activeView: "kanban",
    filters: { search: "", status: "all", construtora: "", obra: "", vendedor: "", equipamento: "", tipoCabineId: "", atrasadoOnly: false, urgenteOnly: false },
  });
  vi.mocked(api.apiListProjects).mockReset().mockResolvedValue([]);
  vi.mocked(api.apiChangeStatus).mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ─── Uma etapa por vez ────────────────────────────────────────────────────────

describe("Kanban no celular — uma etapa por vez", () => {
  it.each([390, 430, 767])("em %ipx renderiza só a etapa ativa, sem arraste", (at) => {
    renderKanban(at, mixedProjects());
    expect(stageRegions()).toHaveLength(1);
    // Etapa inicial = 1ª com projetos na ordem do Kanban de mesa (Cadastro está vazia).
    expect(activeStage()).toBe("Elaborar Ante-Projeto");
    expect(cardCodes()).toEqual(["CRE-000-0001", "CRE-000-0002", "CRE-000-0003"]);
    expect(draggables()).toHaveLength(0);
    // Mesmo cabeçalho da coluna: contagem da etapa + ordenação (Elaborar é ordenável).
    const region = stageRegions()[0];
    expect(within(region).getByText("3 projetos")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: /Ordenar coluna Elaborar Ante-Projeto/ })).toBeInTheDocument();
  });

  it("≥ 768px continua o Kanban de mesa com as 8 colunas arrastáveis", () => {
    renderKanban(768, mixedProjects());
    expect(stageRegions()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /^Etapa: / })).not.toBeInTheDocument();
    expect(document.querySelectorAll("section > header h3")).toHaveLength(8);
    expect(draggables()).toHaveLength(10);
  });

  it("sem projeto em nenhuma etapa, começa pela primeira etapa da ordem", () => {
    renderKanban(390, []);
    expect(activeStage()).toBe("Cadastro Inicial");
  });

  it("seletor lista as 8 etapas na ordem de mesa, com as contagens da mesma lista", async () => {
    renderKanban(390, mixedProjects());
    await userEvent.click(stageTrigger());
    const items = await screen.findAllByRole("menuitemradio");
    expect(items.map((item) => item.getAttribute("aria-label"))).toEqual(
      STAGES.map(([status, label]) => `${label}, ${COUNTS[status]} ${COUNTS[status] === 1 ? "projeto" : "projetos"}`),
    );
    expect(items[1]).toHaveAttribute("aria-checked", "true");
  });

  it("escolher uma etapa distante no seletor troca a etapa exibida", async () => {
    renderKanban(390, mixedProjects());
    await userEvent.click(stageTrigger());
    await userEvent.click(await screen.findByRole("menuitemradio", { name: /^Revisão de Estudo/ }));
    expect(activeStage()).toBe("Revisão de Estudo");
    expect(cardCodes()).toEqual(["CRE-000-0010"]);
    expect(stageTrigger()).toHaveAccessibleName("Etapa: Revisão de Estudo, 1 projeto");
  });

  it("‹ e › andam uma etapa e ficam desabilitados nas pontas", async () => {
    renderKanban(390, [makeProject(1, { status_atual: "CADASTRO INICIAL" })]);
    const prev = screen.getByRole("button", { name: "Etapa anterior" });
    const next = screen.getByRole("button", { name: "Próxima etapa" });
    expect(activeStage()).toBe("Cadastro Inicial");
    expect(prev).toBeDisabled();
    await userEvent.click(next);
    expect(activeStage()).toBe("Elaborar Ante-Projeto");
    expect(screen.getByText("Nenhum projeto nesta etapa.")).toBeInTheDocument();
    await userEvent.click(prev);
    expect(activeStage()).toBe("Cadastro Inicial");
    for (let i = 0; i < 7; i++) await userEvent.click(next);
    expect(activeStage()).toBe("Revisão de Projeto Final");
    expect(next).toBeDisabled();
  });

  it("trocar de etapa não altera nenhum filtro global", async () => {
    renderKanban(390, mixedProjects());
    const before = useProjectsStore.getState().filters;
    await userEvent.click(screen.getByRole("button", { name: "Próxima etapa" }));
    expect(useProjectsStore.getState().filters).toEqual(before);
  });
});

// ─── Filtro global de status ──────────────────────────────────────────────────

describe("Kanban no celular — filtro global de status", () => {
  it("filtro de status = X sincroniza a etapa e trava a navegação; sem filtro volta a navegar", async () => {
    const projects = mixedProjects();
    const { rerender, handlers } = renderKanban(390, projects);
    expect(activeStage()).toBe("Elaborar Ante-Projeto");

    const filtered = projects.filter((p) => p.status_atual === "PROJETO APROVADO");
    act(() => useProjectsStore.getState().setFilters({ status: "PROJETO APROVADO" }));
    rerender(<ProjectsKanban projects={filtered} canDrag {...handlers} />);
    expect(activeStage()).toBe("Projeto Aprovado");
    expect(cardCodes()).toHaveLength(2);
    expect(stageTrigger()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Etapa anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próxima etapa" })).toBeDisabled();
    expect(screen.getByText(/Etapa definida pelo filtro de status/)).toBeInTheDocument();

    act(() => useProjectsStore.getState().setFilters({ status: "all" }));
    rerender(<ProjectsKanban projects={projects} canDrag {...handlers} />);
    expect(stageTrigger()).toBeEnabled();
    expect(activeStage()).toBe("Projeto Aprovado");
    await userEvent.click(screen.getByRole("button", { name: "Próxima etapa" }));
    expect(activeStage()).toBe("Revisão de Estudo");
  });

  it("montado já com filtro de status, a etapa inicial é a do filtro", () => {
    useProjectsStore.setState((s) => ({ filters: { ...s.filters, status: "REVISAO DE PROJETO FINAL" } }));
    renderKanban(390, []);
    expect(activeStage()).toBe("Revisão de Projeto Final");
    expect(stageTrigger()).toBeDisabled();
  });
});

// ─── Estados vazios ───────────────────────────────────────────────────────────

describe("Kanban no celular — estados vazios", () => {
  it("lista filtrada vazia: mensagem de filtros + Limpar filtros (ação da tela)", async () => {
    const { handlers } = renderKanban(390, []);
    expect(screen.getByText("Nenhum projeto corresponde aos filtros.")).toBeInTheDocument();
    expect(screen.queryByText("Nenhum projeto nesta etapa.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(handlers.onClearFilters).toHaveBeenCalledTimes(1);
  });

  it("etapa vazia com projetos em outras: mensagem própria, sem Limpar filtros", async () => {
    renderKanban(390, mixedProjects());
    await userEvent.click(stageTrigger());
    await userEvent.click(await screen.findByRole("menuitemradio", { name: /^Cadastro Inicial/ }));
    expect(screen.getByText("Nenhum projeto nesta etapa.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument();
  });
});

// ─── Card: abrir x menu ───────────────────────────────────────────────────────

describe("Kanban no celular — card", () => {
  it("toque simples no card abre o mesmo detalhe (uma vez)", async () => {
    const { handlers } = renderKanban(390, mixedProjects());
    await userEvent.click(screen.getByRole("button", { name: "Abrir projeto CRE-000-0002" }));
    expect(handlers.onOpen).toHaveBeenCalledTimes(1);
    expect(handlers.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "p2" }));
  });

  it("⋯ tem alvo de 44px, não abre o card e oferece Ver detalhes / Mover para / Criar lembrete", async () => {
    const { handlers } = renderKanban(390, mixedProjects());
    const trigger = screen.getByRole("button", { name: "Abrir ações de CRE-000-0001" });
    expect(trigger).toHaveClass("h-11", "w-11");
    const menu = await openCardMenu("CRE-000-0001");
    expect(handlers.onOpen).not.toHaveBeenCalled();
    expect(within(menu).getAllByRole("menuitem").map((i) => i.getAttribute("aria-label") ?? i.textContent)).toEqual([
      "Ver detalhes",
      "Mover para Ante-Projeto Enviado",
      "Criar lembrete",
    ]);
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Ver detalhes" }));
    expect(handlers.onOpen).toHaveBeenCalledTimes(1);
  });

  it("Criar lembrete do menu usa a mesma ação existente", async () => {
    const { handlers } = renderKanban(390, mixedProjects());
    await openCardMenu("CRE-000-0001");
    await userEvent.click(screen.getByRole("menuitem", { name: "Criar lembrete" }));
    expect(handlers.onCreateReminder).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }));
    expect(handlers.onOpen).not.toHaveBeenCalled();
  });

  it("card do celular não mostra a alça de arraste nem o sino de 17px", () => {
    renderKanban(390, mixedProjects());
    expect(screen.queryByRole("button", { name: /^Criar lembrete para / })).not.toBeInTheDocument();
    expect(document.querySelector(".lucide-grip-vertical")).toBeNull();
  });
});

// ─── Destinos ─────────────────────────────────────────────────────────────────

describe("Mover para — destinos do fluxo", () => {
  const EXPECTED: Array<[ProjectStatus, string[]]> = [
    ["CADASTRO INICIAL", ["Elaborar Ante-Projeto"]],
    ["ELABORAR ANTE-PROJETO", ["Ante-Projeto Enviado"]],
    ["ANTE-PROJETO ENVIADO", ["Ante-Projeto Aprovado", "Revisão de Estudo"]],
    ["ANTE-PROJETO APROVADO", ["Projeto Final Enviado"]],
    ["PROJETO FINAL ENVIADO", ["Projeto Aprovado", "Revisão de Projeto Final"]],
    ["REVISAO DE ESTUDO", ["Ante-Projeto Enviado"]],
    ["REVISAO DE PROJETO FINAL", ["Projeto Final Enviado"]],
  ];

  it.each(EXPECTED)("%s → %j", async (status, destinations) => {
    renderKanban(390, [makeProject(1, { status_atual: status })]);
    await openCardMenu("CRE-000-0001");
    const moves = screen
      .getAllByRole("menuitem")
      .map((i) => i.getAttribute("aria-label"))
      .filter((name): name is string => Boolean(name?.startsWith("Mover para ")));
    expect(moves).toEqual(destinations.map((d) => `Mover para ${d}`));
    expect(screen.getByText("Mover para")).toBeInTheDocument();
  });

  it("etapa terminal (Projeto Aprovado) não tem destino", async () => {
    renderKanban(390, [makeProject(1, { status_atual: "PROJETO APROVADO" })]);
    await openCardMenu("CRE-000-0001");
    expect(screen.queryByText("Mover para")).not.toBeInTheDocument();
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Ver detalhes", "Criar lembrete"]);
  });

  it("terminal sem permissão de lembrete: o ⋯ só teria Ver detalhes → não aparece", () => {
    renderKanban(390, [makeProject(1, { status_atual: "PROJETO APROVADO" })], { onCreateReminder: undefined });
    expect(screen.queryByRole("button", { name: /^Abrir ações de / })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir projeto CRE-000-0001" })).toBeInTheDocument();
  });
});

// ─── Perfis sem movimentação ──────────────────────────────────────────────────

describe("Mover para — permissões", () => {
  it("sem permissão de mover (SELLER/COMMERCIAL/VIEWER): sem ⋯, card abre por toque", async () => {
    const { handlers } = renderKanban(390, mixedProjects(), { canDrag: false, onCreateReminder: undefined });
    expect(screen.queryByRole("button", { name: /^Abrir ações de / })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Abrir projeto CRE-000-0001" }));
    expect(handlers.onOpen).toHaveBeenCalledTimes(1);
  });

  it("sem changeStatus mas com lembretes: ⋯ sem nenhum destino", async () => {
    renderKanban(390, mixedProjects(), { canDrag: false });
    await openCardMenu("CRE-000-0001");
    expect(screen.queryByText("Mover para")).not.toBeInTheDocument();
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Ver detalhes", "Criar lembrete"]);
  });

  it("sem permissão de mover na mesa: nenhum card arrastável e nenhum destino no ⋯", async () => {
    renderKanban(1280, mixedProjects(), { canDrag: false });
    expect(screen.queryAllByRole("button", { name: /^Abrir ações de / })).toHaveLength(10);
    await openCardMenu("CRE-000-0001");
    expect(screen.queryByText("Mover para")).not.toBeInTheDocument();
  });
});

// ─── Fluxos de transição (os mesmos do arraste) ───────────────────────────────

describe("Mover para — mesmos diálogos e mesma chamada do arraste", () => {
  it("destino simples: confirmação De/Para e onMoveStatus sem observação", async () => {
    const { handlers } = renderKanban(390, mixedProjects());
    await moveViaMenu("CRE-000-0001", "Ante-Projeto Enviado");
    const dialog = screen.getByRole("dialog", { name: "Confirmar alteracao de status?" });
    expect(dialog).toHaveTextContent("De: ELABORAR ANTE-PROJETO");
    expect(dialog).toHaveTextContent("Para: ANTE-PROJETO ENVIADO");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar alteracao" }));
    expect(handlers.onMoveStatus).toHaveBeenCalledTimes(1);
    expect(handlers.onMoveStatus).toHaveBeenCalledWith("p1", "ANTE-PROJETO ENVIADO", undefined);
    expect(handlers.notify).toHaveBeenCalledWith("Projeto movido para ANTE-PROJETO ENVIADO.");
  });

  it("revisão exige observação antes de confirmar", async () => {
    const { handlers } = renderKanban(390, [makeProject(1, { status_atual: "ANTE-PROJETO ENVIADO" })]);
    await moveViaMenu("CRE-000-0001", "Revisão de Estudo");
    const dialog = screen.getByRole("dialog", { name: "Confirmar alteracao de status?" });
    const confirm = within(dialog).getByRole("button", { name: "Confirmar alteracao" });
    expect(confirm).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText("Observacao obrigatoria"), "Cliente pediu ajuste");
    await userEvent.click(confirm);
    expect(handlers.onMoveStatus).toHaveBeenCalledWith("p1", "REVISAO DE ESTUDO", "Cliente pediu ajuste");
  });

  it("Projeto Final Enviado pede o código final", async () => {
    const { handlers } = renderKanban(390, [makeProject(1, { status_atual: "ANTE-PROJETO APROVADO" })]);
    await moveViaMenu("CRE-000-0001", "Projeto Final Enviado");
    const dialog = await screen.findByRole("dialog", { name: "Confirmar o código do projeto" });
    const input = within(dialog).getByLabelText(/Código final/);
    await waitFor(() => expect(input).toHaveValue("CRE-000-0001"));
    await userEvent.clear(input);
    await userEvent.type(input, "CRE-000-2026");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    expect(handlers.onMoveStatus).toHaveBeenCalledWith("p1", "PROJETO FINAL ENVIADO", undefined, "CRE-000-2026");
    expect(handlers.notify).toHaveBeenCalledWith("Projeto final enviado com o codigo CRE-000-2026.");
  });

  it("Cadastro Inicial com pré-requisito pendente abre o bloqueio; Editar projeto abre o detalhe", async () => {
    const pending = makeProject(1, { status_atual: "CADASTRO INICIAL", alinhamento: false });
    const { handlers } = renderKanban(390, [pending]);
    await moveViaMenu("CRE-000-0001", "Elaborar Ante-Projeto");
    const alert = screen.getByRole("alertdialog", { name: "Nao e possivel mover este projeto" });
    expect(alert).toHaveTextContent("Alinhamento concluído");
    expect(handlers.onMoveStatus).not.toHaveBeenCalled();
    await userEvent.click(within(alert).getByRole("button", { name: "Editar projeto" }));
    expect(handlers.onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "p1" }));
  });

  it("cancelar a confirmação não move", async () => {
    const { handlers } = renderKanban(390, mixedProjects());
    await moveViaMenu("CRE-000-0001", "Ante-Projeto Enviado");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(handlers.onMoveStatus).not.toHaveBeenCalled();
    expect(handlers.notify).toHaveBeenCalledWith("Alteracao cancelada.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancelar o código final não move", async () => {
    const { handlers } = renderKanban(390, [makeProject(1, { status_atual: "ANTE-PROJETO APROVADO" })]);
    await moveViaMenu("CRE-000-0001", "Projeto Final Enviado");
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar movimentação" }));
    expect(handlers.onMoveStatus).not.toHaveBeenCalled();
    expect(handlers.notify).toHaveBeenCalledWith("Movimentacao cancelada.");
  });

  it("recusa da transição: mensagem de erro e o card continua na etapa", async () => {
    const { handlers } = renderKanban(390, mixedProjects(), {
      onMoveStatus: vi.fn(() => ({ ok: false, error: "Transicao de status nao permitida." })),
    });
    await moveViaMenu("CRE-000-0001", "Ante-Projeto Enviado");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar alteracao" }));
    expect(handlers.notify).toHaveBeenCalledWith("Transicao de status nao permitida.");
    expect(cardCodes()).toContain("CRE-000-0001");
  });
});

// ─── Fallback de toque na mesa (768/820/1024 com ponteiro grosso) ─────────────

describe("Kanban de mesa — fallback de toque", () => {
  it.each([768, 820, 1024, 1366])("em %ipx o ⋯ existe só para ponteiro grosso e usa o mesmo fluxo", async (at) => {
    const { handlers } = renderKanban(at, mixedProjects());
    const trigger = screen.getByRole("button", { name: "Abrir ações de CRE-000-0001" });
    // Ponteiro fino: display:none (mesa visualmente idêntica); ponteiro grosso: visível.
    const wrapper = trigger.parentElement!;
    expect(wrapper).toHaveClass("hidden", "pointer-coarse:inline-flex");
    expect(wrapper).not.toHaveClass("inline-flex");
    // O card continua arrastável para mouse.
    expect(draggables()).toHaveLength(10);

    await moveViaMenu("CRE-000-0001", "Ante-Projeto Enviado");
    expect(handlers.onOpen).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Confirmar alteracao" }));
    expect(handlers.onMoveStatus).toHaveBeenCalledWith("p1", "ANTE-PROJETO ENVIADO", undefined);
  });

  it("duplo clique no ⋯ não abre o card de mesa", async () => {
    const { handlers } = renderKanban(1280, mixedProjects());
    await userEvent.dblClick(screen.getByRole("button", { name: "Abrir ações de CRE-000-0001" }));
    expect(handlers.onOpen).not.toHaveBeenCalled();
  });
});

// ─── Arraste de mesa preservado (mesmo requestMove) ───────────────────────────

// jsdom não tem layout: cada coluna recebe um retângulo pela posição na grade, e os
// cards herdam o retângulo da coluna. Eventos de ponteiro reais acionam o dnd-kit.
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  isPrimary: boolean;
  pointerType: string;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.isPrimary = init.isPrimary ?? true;
    this.pointerType = init.pointerType ?? "mouse";
  }
}
function installColumnRects() {
  const labels = STAGES.map(([, label]) => label);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const section = this.closest("section");
    const label = section?.querySelector(":scope > header h3")?.textContent?.trim() ?? "";
    const i = labels.indexOf(label);
    const left = i < 0 ? -10_000 : i * 300;
    return { x: left, y: 0, left, top: 0, width: 280, height: 600, right: left + 280, bottom: 600, toJSON: () => ({}) } as DOMRect;
  });
}
function pointer(target: Document | Element, type: string, x: number, y = 100) {
  fireEvent(target, new TestPointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: 1 }));
}
const colX = (label: string) => STAGES.findIndex(([, l]) => l === label) * 300 + 100;
async function dragCard(code: string, from: string, to: string) {
  const card = screen.getByText(code).closest("article")!;
  act(() => pointer(card, "pointerdown", colX(from)));
  for (const x of [colX(from) + 20, (colX(from) + colX(to)) / 2, colX(to)]) act(() => pointer(document, "pointermove", x));
  await act(async () => {
    pointer(document, "pointerup", colX(to));
    await Promise.resolve();
  });
}

describe("Kanban de mesa — arraste preservado", () => {
  const originalPointerEvent = window.PointerEvent;
  beforeEach(() => {
    (window as unknown as { PointerEvent: typeof TestPointerEvent }).PointerEvent = TestPointerEvent;
    installColumnRects();
  });
  afterEach(() => {
    window.PointerEvent = originalPointerEvent;
  });

  it("arrastar e soltar abre a MESMA confirmação e chama onMoveStatus igual ao menu", async () => {
    const { handlers } = renderKanban(1280, mixedProjects());
    await dragCard("CRE-000-0001", "Elaborar Ante-Projeto", "Ante-Projeto Enviado");
    const dialog = await screen.findByRole("dialog", { name: "Confirmar alteracao de status?" });
    expect(dialog).toHaveTextContent("Para: ANTE-PROJETO ENVIADO");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar alteracao" }));
    expect(handlers.onMoveStatus).toHaveBeenCalledWith("p1", "ANTE-PROJETO ENVIADO", undefined);
  });

  it("arrastar para destino fora do fluxo abre o bloqueio (mesma regra do menu)", async () => {
    const { handlers } = renderKanban(1280, mixedProjects());
    await dragCard("CRE-000-0001", "Elaborar Ante-Projeto", "Projeto Aprovado");
    expect(await screen.findByRole("alertdialog", { name: "Nao e possivel mover este projeto" })).toHaveTextContent(
      'Movimentação de "ELABORAR ANTE-PROJETO" para "PROJETO APROVADO" não é permitida no fluxo.',
    );
    expect(handlers.onMoveStatus).not.toHaveBeenCalled();
  });

  it("trocar para o celular no meio do arraste zera o estado (sem arraste fantasma)", async () => {
    renderKanban(1280, mixedProjects());
    const card = screen.getByText("CRE-000-0001").closest("article")!;
    act(() => pointer(card, "pointerdown", colX("Elaborar Ante-Projeto")));
    act(() => pointer(document, "pointermove", colX("Elaborar Ante-Projeto") + 40));
    expect(document.querySelector('article[style*="scale(1.03)"]')).not.toBeNull();

    resizeTo(390);
    expect(draggables()).toHaveLength(0);
    resizeTo(1280);
    expect(document.querySelector('article[style*="scale(1.03)"]')).toBeNull();
    expect(draggables()).toHaveLength(10);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Nenhum listener do arraste sobrou engolindo cliques.
    await act(() => new Promise((r) => setTimeout(r, 80)));
    await openCardMenu("CRE-000-0001");
    expect(screen.getByRole("menuitem", { name: "Ver detalhes" })).toBeInTheDocument();
  });
});

// ─── Redimensionamento e rollback pela tela real ──────────────────────────────

describe("Kanban — tela real (shell + store)", () => {
  async function renderShell(at: number, projects: Project[]) {
    width = at;
    vi.mocked(api.apiListProjects).mockResolvedValue(projects);
    render(<ProjectsPageShell />);
    await waitFor(() => expect(useProjectsStore.getState().loadStatus).toBe("ready"));
  }

  it("767 → 768 → 767 sem nova carga, sem duplicar e sem perder etapa, filtros ou ordenação", async () => {
    await renderShell(767, mixedProjects());
    await screen.findByRole("region", { name: "Etapa Elaborar Ante-Projeto" });
    const loads = vi.mocked(api.apiListProjects).mock.calls.length;

    act(() => useProjectsStore.getState().setFilters({ search: "CRE-000" }));
    await userEvent.click(screen.getByRole("button", { name: "Ordenar coluna Elaborar Ante-Projeto" }));
    await userEvent.click(screen.getByRole("menuitemradio", { name: /novo → antigo/ }));
    await userEvent.click(screen.getByRole("button", { name: "Próxima etapa" }));
    expect(activeStage()).toBe("Ante-Projeto Enviado");

    resizeTo(768);
    expect(stageRegions()).toHaveLength(0);
    expect(draggables()).toHaveLength(10);
    resizeTo(767);
    expect(activeStage()).toBe("Ante-Projeto Enviado");
    expect(cardCodes()).toEqual(["CRE-000-0004", "CRE-000-0005"]);
    expect(useProjectsStore.getState().filters.search).toBe("CRE-000");
    expect(JSON.parse(window.localStorage.getItem("tsteck:kanban:sortModes") ?? "{}")).toEqual({ "ELABORAR ANTE-PROJETO": "newest" });
    expect(vi.mocked(api.apiListProjects).mock.calls.length).toBe(loads);
  });

  it("Limpar filtros do estado vazio usa a ação existente da tela", async () => {
    await renderShell(390, mixedProjects());
    act(() => useProjectsStore.getState().setFilters({ search: "nada-corresponde", urgenteOnly: true }));
    // (a toolbar tem o seu próprio "Limpar filtros"; aqui é o do estado vazio da etapa)
    const stage = await screen.findByRole("region", { name: /^Etapa / });
    await userEvent.click(within(stage).getByRole("button", { name: "Limpar filtros" }));
    expect(useProjectsStore.getState().filters).toMatchObject({ search: "", urgenteOnly: false, status: "all" });
    expect(await screen.findByRole("region", { name: "Etapa Elaborar Ante-Projeto" })).toBeInTheDocument();
  });

  it("falha da API ao mover pelo menu: rollback pelo store (mesmo caminho do arraste)", async () => {
    const projects = mixedProjects();
    await renderShell(390, projects);
    vi.mocked(api.apiChangeStatus).mockRejectedValue(new Error("Falha simulada"));
    const loads = vi.mocked(api.apiListProjects).mock.calls.length;

    await moveViaMenu("CRE-000-0001", "Ante-Projeto Enviado");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar alteracao" }));

    expect(api.apiChangeStatus).toHaveBeenCalledWith("p1", "ANTE-PROJETO ENVIADO", expect.objectContaining({ source: "kanban" }));
    // Recarga do MySQL (hydrate) desfaz a mudança otimista.
    await waitFor(() => expect(vi.mocked(api.apiListProjects).mock.calls.length).toBe(loads + 1));
    await waitFor(() =>
      expect(useProjectsStore.getState().projects.find((p) => p.id === "p1")?.status_atual).toBe("ELABORAR ANTE-PROJETO"),
    );
    expect(activeStage()).toBe("Elaborar Ante-Projeto");
    expect(cardCodes()).toContain("CRE-000-0001");
  });
});
