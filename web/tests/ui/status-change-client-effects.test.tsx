import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { Project, ProjectStatus } from "@/features/projects/domain/project-types";

// Backlog P — o navegador NÃO grava observação nem dispara e-mail por conta
// própria ao mudar status (antes fazia isso logo após o sucesso otimista, mesmo
// quando o servidor recusava). Só o POST /status sai; o servidor faz o resto.

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

import { ProjectsPageShell } from "@/features/projects/components/projects-page-shell";
import { useProjectsStore } from "@/features/projects/state/projects-store";
import * as api from "@/features/projects/lib/projects-api";

// Nenhum pedido do navegador pode ir para /api/notifications/* — a rota de
// movimentação foi removida (Backlog V); os e-mails saem do servidor.
const fetchSpy = vi.spyOn(globalThis, "fetch");
const notificationRequests = () =>
  fetchSpy.mock.calls
    .map(([input]) => (input instanceof Request ? input.url : String(input)))
    .filter((url) => url.includes("/api/notifications/"));

// ── matchMedia controlável ────────────────────────────────────────────────────
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

function makeProject(n: number, status: ProjectStatus): Project {
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
    status_atual: status,
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
  } as Project;
}

const PROJECTS = [makeProject(1, "ELABORAR ANTE-PROJETO"), makeProject(2, "ANTE-PROJETO ENVIADO"), makeProject(3, "ANTE-PROJETO APROVADO")];

async function renderShell(at: number, view: "kanban" | "table") {
  width = at;
  useProjectsStore.setState({ activeView: view });
  vi.mocked(api.apiListProjects).mockResolvedValue(PROJECTS.map((p) => ({ ...p })));
  render(<ProjectsPageShell />);
  await waitFor(() => expect(useProjectsStore.getState().loadStatus).toBe("ready"));
}

/** Espera o POST /status (e a recarga em caso de falha) e confirma: nada além dele. */
async function expectOnlyStatusRequest(expected: Parameters<typeof api.apiChangeStatus>) {
  await waitFor(() => expect(api.apiChangeStatus).toHaveBeenCalledTimes(1));
  expect(api.apiChangeStatus).toHaveBeenCalledWith(...expected);
  // Deixa promessas pendentes resolverem (antes, os efeitos saíam aqui).
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
  expect(api.apiAddObservation).not.toHaveBeenCalled();
  expect(notificationRequests()).toEqual([]);
}

beforeEach(() => {
  installMatchMedia();
  window.localStorage.clear();
  window.sessionStorage.setItem("tsteck:reminders:alerted", "1");
  useProjectsStore.setState({
    projects: [],
    loadStatus: "idle",
    reminders: [],
    observations: [],
    filters: { search: "", status: "all", construtora: "", obra: "", vendedor: "", equipamento: "", tipoCabineId: "", atrasadoOnly: false, urgenteOnly: false },
  });
  vi.mocked(api.apiChangeStatus).mockReset();
  vi.mocked(api.apiAddObservation).mockClear();
  fetchSpy.mockClear();
});

afterEach(() => {
  cleanup();
});

describe("Kanban — só o POST /status sai do navegador", () => {
  async function moveInKanban() {
    await userEvent.click(await screen.findByRole("button", { name: "Abrir ações de CRE-000-0001" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Mover para Ante-Projeto Enviado" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar alteracao" }));
  }

  it("sucesso: sem observação/e-mail pelo cliente (o servidor faz)", async () => {
    await renderShell(390, "kanban");
    vi.mocked(api.apiChangeStatus).mockResolvedValue({ ...PROJECTS[0], status_atual: "ANTE-PROJETO ENVIADO" });
    await moveInKanban();
    await expectOnlyStatusRequest(["p1", "ANTE-PROJETO ENVIADO", expect.objectContaining({ source: "kanban" })]);
    expect(await screen.findByText("Projeto movido para ANTE-PROJETO ENVIADO.")).toBeInTheDocument();
  });

  it("falha do servidor (cenário original do Backlog P): nenhum efeito pelo cliente e rollback", async () => {
    await renderShell(390, "kanban");
    vi.mocked(api.apiChangeStatus).mockRejectedValue(new Error("Falha simulada: status não alterado."));
    await moveInKanban();
    await expectOnlyStatusRequest(["p1", "ANTE-PROJETO ENVIADO", expect.objectContaining({ source: "kanban" })]);
    await waitFor(() =>
      expect(useProjectsStore.getState().projects.find((p) => p.id === "p1")?.status_atual).toBe("ELABORAR ANTE-PROJETO"),
    );
  });

  it("revisão: motivo vai só no POST /status (reason/note)", async () => {
    await renderShell(390, "kanban");
    vi.mocked(api.apiChangeStatus).mockRejectedValue(new Error("falha"));
    await userEvent.click(screen.getByRole("button", { name: "Próxima etapa" }));
    await userEvent.click(await screen.findByRole("button", { name: "Abrir ações de CRE-000-0002" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Mover para Revisão de Estudo" }));
    await userEvent.type(screen.getByLabelText("Observacao obrigatoria"), "Cliente pediu ajuste");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar alteracao" }));
    await expectOnlyStatusRequest([
      "p2",
      "REVISAO DE ESTUDO",
      expect.objectContaining({ source: "kanban", reason: "Cliente pediu ajuste", note: "Cliente pediu ajuste" }),
    ]);
  });
});

describe("Tabela — menu de ações e código final", () => {
  async function openStatusDialog(code: string) {
    const row = (await screen.findByText(code)).closest("tr")!;
    await userEvent.click(within(row).getByRole("button", { name: "Abrir acoes do projeto" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Alterar status/ }));
    return screen.getByRole("dialog", { name: "Alterar status do projeto" });
  }

  it("Alterar status com observação: só o POST /status (source acao-rapida)", async () => {
    await renderShell(1280, "table");
    vi.mocked(api.apiChangeStatus).mockRejectedValue(new Error("falha"));
    const dialog = await openStatusDialog("CRE-000-0002");
    await userEvent.selectOptions(within(dialog).getByRole("combobox"), "REVISAO DE ESTUDO");
    await userEvent.type(within(dialog).getByRole("textbox"), "Motivo detalhado da revisão");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar mudanca" }));
    await expectOnlyStatusRequest([
      "p2",
      "REVISAO DE ESTUDO",
      expect.objectContaining({ source: "acao-rapida", note: "Motivo detalhado da revisão" }),
    ]);
  });

  it("Projeto Final Enviado pelo menu: código final no POST /status e nada mais", async () => {
    await renderShell(1280, "table");
    vi.mocked(api.apiChangeStatus).mockRejectedValue(new Error("falha"));
    const dialog = await openStatusDialog("CRE-000-0003");
    await userEvent.selectOptions(within(dialog).getByRole("combobox"), "PROJETO FINAL ENVIADO");
    await userEvent.type(within(dialog).getByRole("textbox"), "Enviado ao cliente");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar mudanca" }));
    const code = await screen.findByRole("dialog", { name: "Confirmar o código do projeto" });
    const input = within(code).getByLabelText(/Código final/);
    await waitFor(() => expect(input).toHaveValue("CRE-000-0003"));
    await userEvent.clear(input);
    await userEvent.type(input, "CRE-000-9999");
    await userEvent.click(within(code).getByRole("button", { name: "Confirmar" }));
    await expectOnlyStatusRequest([
      "p3",
      "PROJETO FINAL ENVIADO",
      expect.objectContaining({ source: "acao-rapida", finalCode: "CRE-000-9999", note: "Enviado ao cliente" }),
    ]);
  });
});
