import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { Project } from "@/features/projects/domain/project-types";

// Backlog W — ao marcar/remover urgência o navegador faz SÓ o pedido de urgência.
// Observação e e-mail ao vendedor são do servidor, depois de gravar (antes o
// navegador os disparava por conta própria, mesmo quando o servidor recusava).

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({
    session: {
      user: { name: "Teste", username: "teste", role: "ADMIN", permissions: getDefaultPermissions("ADMIN"), sellerId: null },
    },
    isLoading: false,
  }),
}));

vi.mock("@/features/projects/lib/projects-api", async (orig) => ({
  ...(await orig<typeof import("@/features/projects/lib/projects-api")>()),
  apiListProjects: vi.fn(async () => []),
  apiSetUrgency: vi.fn(),
  apiAddObservation: vi.fn(async () => ({})),
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

vi.mock("@/features/projects/services/project-notification-service", async (orig) => ({
  ...(await orig<typeof import("@/features/projects/services/project-notification-service")>()),
  sendProjectNotification: vi.fn(async () => ({ success: true, message: "ok" })),
}));

import { ProjectsPageShell } from "@/features/projects/components/projects-page-shell";
import { useProjectsStore } from "@/features/projects/state/projects-store";
import * as api from "@/features/projects/lib/projects-api";
import * as notifications from "@/features/projects/services/project-notification-service";

function installMatchMedia() {
  window.matchMedia = ((query: string) => ({
    media: query,
    matches: /min-width:\s*(\d+)px/.test(query) ? 1280 >= Number(/(\d+)px/.exec(query)![1]) : false,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => true,
  })) as unknown as typeof window.matchMedia;
}

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

const NORMAL = makeProject(1);
const URGENT = makeProject(2, { urgente: true, urgentDeadline: "2099-01-10", urgentReason: "cliente" });

async function renderShell() {
  useProjectsStore.setState({ activeView: "table" });
  vi.mocked(api.apiListProjects).mockResolvedValue([{ ...NORMAL }, { ...URGENT }]);
  render(<ProjectsPageShell />);
  await waitFor(() => expect(useProjectsStore.getState().loadStatus).toBe("ready"));
}

async function openRowMenu(code: string) {
  const row = (await screen.findByText(code)).closest("tr")!;
  await userEvent.click(within(row).getByRole("button", { name: "Abrir acoes do projeto" }));
}

/** Espera o pedido de urgência e confirma que nada mais saiu do navegador. */
async function expectOnlyUrgencyRequest(expected: Parameters<typeof api.apiSetUrgency>) {
  await waitFor(() => expect(api.apiSetUrgency).toHaveBeenCalledTimes(1));
  expect(api.apiSetUrgency).toHaveBeenCalledWith(...expected);
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
  expect(api.apiAddObservation).not.toHaveBeenCalled();
  expect(notifications.sendProjectNotification).not.toHaveBeenCalled();
}

async function markUrgent() {
  await openRowMenu("CRE-000-0001");
  await userEvent.click(await screen.findByRole("menuitem", { name: /Marcar como urgente/ }));
  const dialog = screen.getByTestId("urgency-deadline-dialog");
  fireEvent.change(dialog.querySelector("#urgency-deadline")!, { target: { value: "2099-01-10" } });
  await userEvent.type(dialog.querySelector("#urgency-reason")!, "Cliente pediu prioridade");
  await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar urgência" }));
}

async function removeUrgency() {
  await openRowMenu("CRE-000-0002");
  await userEvent.click(await screen.findByRole("menuitem", { name: /Remover urgencia/ }));
  const dialog = screen.getByRole("dialog", { name: "Remover prioridade urgente?" });
  await userEvent.click(within(dialog).getByRole("button", { name: "Remover urgencia" }));
}

beforeEach(() => {
  installMatchMedia();
  window.sessionStorage.setItem("tsteck:reminders:alerted", "1");
  useProjectsStore.setState({
    projects: [],
    loadStatus: "idle",
    reminders: [],
    observations: [],
    filters: { search: "", status: "all", construtora: "", obra: "", vendedor: "", equipamento: "", tipoCabineId: "", atrasadoOnly: false, urgenteOnly: false },
  });
  vi.mocked(api.apiSetUrgency).mockReset();
  vi.mocked(api.apiAddObservation).mockClear();
  vi.mocked(notifications.sendProjectNotification).mockClear();
});

afterEach(() => {
  cleanup();
});

describe("Marcar como urgente — só o pedido de urgência sai do navegador", () => {
  it("sucesso: sem observação/e-mail pelo cliente", async () => {
    await renderShell();
    vi.mocked(api.apiSetUrgency).mockResolvedValue({ ...NORMAL, urgente: true, urgentDeadline: "2099-01-10", urgentReason: "Cliente pediu prioridade" });
    await markUrgent();
    await expectOnlyUrgencyRequest(["p1", true, "Cliente pediu prioridade", "2099-01-10"]);
    expect(await screen.findByText("Projeto marcado como urgente.")).toBeInTheDocument();
  });

  it("servidor recusa (ex.: 403 de perfil sem markUrgent): nenhum efeito pelo cliente e rollback", async () => {
    await renderShell();
    vi.mocked(api.apiSetUrgency).mockRejectedValue(new Error("Você não tem permissão para executar esta ação."));
    await markUrgent();
    await expectOnlyUrgencyRequest(["p1", true, "Cliente pediu prioridade", "2099-01-10"]);
    await waitFor(() => expect(useProjectsStore.getState().projects.find((p) => p.id === "p1")?.urgente).toBe(false));
  });
});

describe("Remover urgência — só o pedido de urgência sai do navegador", () => {
  it("sucesso: sem a observação 'Urgencia removida por…' nem e-mail pelo cliente", async () => {
    await renderShell();
    vi.mocked(api.apiSetUrgency).mockResolvedValue({ ...URGENT, urgente: false, urgentDeadline: null, urgentReason: null });
    await removeUrgency();
    await expectOnlyUrgencyRequest(["p2", false, undefined, undefined]);
    expect(await screen.findByText("Urgencia removida do projeto.")).toBeInTheDocument();
  });

  it("servidor recusa: nenhum efeito pelo cliente e a urgência volta", async () => {
    await renderShell();
    vi.mocked(api.apiSetUrgency).mockRejectedValue(new Error("falha"));
    await removeUrgency();
    await expectOnlyUrgencyRequest(["p2", false, undefined, undefined]);
    await waitFor(() => expect(useProjectsStore.getState().projects.find((p) => p.id === "p2")?.urgente).toBe(true));
  });
});
