import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Layers } from "lucide-react";
import type { ComponentType } from "react";

// Fase 4: Cadastros em cards no celular (< 768px). Mesmos itens (já filtrados
// pela página), mesma ordem e mesmos handlers da tabela — só muda a apresentação.

vi.mock("@/features/master-data/lib/master-data-api", () => ({
  listEntity: vi.fn(),
  createEntity: vi.fn(),
  updateEntity: vi.fn(),
  setEntityActive: vi.fn(async () => ({})),
}));

import * as api from "@/features/master-data/lib/master-data-api";
import { MasterDataTable } from "@/features/master-data/components/master-data-table";
import ConstrutorasPage from "@/app/(main)/cadastros/construtoras/page";
import ObrasPage from "@/app/(main)/cadastros/obras/page";
import EquipamentosPage from "@/app/(main)/cadastros/equipamentos/page";
import TiposCabinePage from "@/app/(main)/cadastros/tipos-cabine/page";
import VendedoresPage from "@/app/(main)/cadastros/vendedores/page";
import EngenheirosPage from "@/app/(main)/cadastros/engenheiros/page";

// ── matchMedia controlável (mesmo padrão das Fases 2 e 3) ────────────────────
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

const base = { createdAt: "2026-01-01", updatedAt: "2026-01-01", createdBy: "teste" };
const DATA: Record<string, Array<Record<string, unknown>>> = {
  construtoras: [
    { id: "c2", name: "BETA ENGENHARIA", cnpj: "12345678000190", phone: "11999998888", email: "contato@beta.com.br", active: true, ...base },
    { id: "c1", name: "ALFA CONSTRUCOES", cnpj: "", phone: "", email: "", active: false, ...base },
  ],
  obras: [
    { id: "o1", name: "RESIDENCIAL AURORA", construtoraName: "BETA ENGENHARIA", city: "Santos", active: true, ...base },
    { id: "o2", name: "TORRE SUL", construtoraName: "ALFA CONSTRUCOES", city: "", active: true, ...base },
  ],
  construtorasAtivas: [{ id: "c2", name: "BETA ENGENHARIA", active: true, ...base }],
  unidadesObra: [
    { id: "u1", workId: "o1", name: "BLOCO A", sortOrder: 1, projectsCount: 2, active: true, ...base },
    { id: "u2", workId: "o1", name: "BLOCO B", sortOrder: 2, projectsCount: 0, active: true, ...base },
  ],
  equipamentos: [{ id: "e1", code: "EK-15/26", description: "Elevador de carga", family: "EK", capacity: "1500kg", active: true, ...base }],
  tiposCabine: [{ id: "t1", name: "Padrão", description: "Cabine padrão de aço inox", active: true, ...base }],
  vendedores: [{ id: "v1", name: "MARIA SOUZA", email: "maria@tsteck.com.br", phone: "11988887777", active: true, ...base }],
  engenheiros: [{ id: "g1", name: "JOAO LIMA", email: "joao@tsteck.com.br", phone: "", active: true, ...base }],
};

beforeEach(() => {
  listeners.clear();
  installMatchMedia();
  vi.mocked(api.listEntity).mockReset();
  vi.mocked(api.listEntity).mockImplementation(async (entity: string, includeInactive?: boolean) => {
    if (entity === "construtoras" && !includeInactive) return DATA.construtorasAtivas as never;
    return (DATA[entity] ?? []) as never;
  });
  vi.mocked(api.setEntityActive).mockClear();
  window.confirm = vi.fn(() => true);
});

afterEach(() => cleanup());

const PAGES: Array<{ name: string; Page: ComponentType; list: string; first: string; secondary: string }> = [
  { name: "Construtoras", Page: ConstrutorasPage, list: "Construtora", first: "BETA ENGENHARIA", secondary: "12.345.678/0001-90" },
  { name: "Obras", Page: ObrasPage, list: "Obra", first: "RESIDENCIAL AURORA", secondary: "BETA ENGENHARIA" },
  { name: "Equipamentos", Page: EquipamentosPage, list: "Equipamento", first: "EK-15/26", secondary: "Elevador de carga" },
  { name: "Tipos de Cabine", Page: TiposCabinePage, list: "Tipo de Cabine", first: "Padrão", secondary: "Cabine padrão de aço inox" },
  { name: "Vendedores", Page: VendedoresPage, list: "Vendedor", first: "MARIA SOUZA", secondary: "maria@tsteck.com.br" },
  { name: "Engenheiros", Page: EngenheirosPage, list: "Engenheiro", first: "JOAO LIMA", secondary: "joao@tsteck.com.br" },
];

const cardTitles = (list: string) =>
  within(screen.getByRole("list", { name: list })).getAllByRole("heading").map((h) => h.textContent);
const tableFirstCells = () =>
  within(screen.getByRole("table")).getAllByRole("row").slice(1).map((r) => r.textContent ?? "");

describe.each(PAGES)("$name", ({ Page, list, first, secondary }) => {
  async function renderAt(at: number) {
    width = at;
    render(<Page />);
    await waitFor(() => expect(screen.queryByText(/Carregando/)).not.toBeInTheDocument());
  }

  it.each([390, 430, 767])("%ipx: cards, sem tabela", async (at) => {
    await renderAt(at);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const cards = within(screen.getByRole("list", { name: list })).getAllByRole("listitem");
    expect(cards.length).toBeGreaterThan(0);
    expect(within(cards[0]).getByRole("heading")).toHaveTextContent(first);
    expect(within(cards[0]).getByText(secondary)).toBeInTheDocument();
    // ⋯ com alvo de 44px.
    expect(within(cards[0]).getByRole("button", { name: /^Abrir ações de/ })).toHaveClass("h-11", "w-11");
  });

  it.each([768, 1024, 1920])("%ipx: tabela, sem cards", async (at) => {
    await renderAt(at);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: list })).not.toBeInTheDocument();
  });

  it("mesma quantidade e mesma ordem; 767 → 768 → 767 sem nova request", async () => {
    await renderAt(767);
    const calls = vi.mocked(api.listEntity).mock.calls.length;
    const titles = cardTitles(list);
    resizeTo(768);
    const rows = tableFirstCells();
    expect(rows).toHaveLength(titles.length);
    titles.forEach((t, i) => expect(rows[i]).toContain(t));
    resizeTo(767);
    expect(cardTitles(list)).toEqual(titles);
    expect(vi.mocked(api.listEntity).mock.calls.length).toBe(calls);
  });
});

describe("busca e estados (comportamento atual preservado)", () => {
  it("a busca da página filtra os cards", async () => {
    width = 390;
    render(<ConstrutorasPage />);
    await waitFor(() => expect(cardTitles("Construtora")).toHaveLength(2));
    await userEvent.type(screen.getByRole("textbox", { name: "Buscar Construtora" }), "alfa");
    expect(cardTitles("Construtora")).toEqual(["ALFA CONSTRUCOES"]);
    await userEvent.clear(screen.getByRole("textbox", { name: "Buscar Construtora" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Buscar Construtora" }), "zzz");
    expect(screen.getByText("Nenhum registro encontrado.")).toBeInTheDocument();
  });

  it("loading: mesmo indicador atual", async () => {
    width = 390;
    vi.mocked(api.listEntity).mockImplementation(() => new Promise(() => {}));
    render(<VendedoresPage />);
    expect(screen.getByText("Carregando vendedors…")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Vendedor" })).not.toBeInTheDocument();
  });

  it("erro: mesma mensagem atual", async () => {
    width = 390;
    vi.mocked(api.listEntity).mockRejectedValue(new Error("Falha ao carregar vendedores."));
    render(<VendedoresPage />);
    expect(await screen.findByText("Falha ao carregar vendedores.")).toBeInTheDocument();
  });

  it("vazio: mesma mensagem atual", async () => {
    width = 390;
    vi.mocked(api.listEntity).mockResolvedValue([]);
    render(<EngenheirosPage />);
    expect(await screen.findByText("Nenhum registro encontrado.")).toBeInTheDocument();
  });
});

describe("menu ⋯ e ações (mesmos handlers da tabela)", () => {
  type Row = { id: string; name: string; active: boolean; createdAt: string; updatedAt: string; createdBy: string };
  const active: Row = { id: "a", name: "ATIVA LTDA", active: true, ...base };
  const inactive: Row = { id: "b", name: "INATIVA LTDA", active: false, ...base };
  const units = vi.fn();

  function renderTable(at: number, items: Row[] = [active, inactive]) {
    width = at;
    const handlers = { onAdd: vi.fn(), onEdit: vi.fn(), onToggle: vi.fn(), onDelete: vi.fn() };
    render(
      <MasterDataTable<Row>
        items={items}
        columns={[
          { key: "name", label: "Nome" },
          { key: "unidades", label: "Unidades", render: () => "2 unidades" },
          { key: "active", label: "Status", render: (i) => (i.active ? "Ativo" : "Inativo") },
        ]}
        {...handlers}
        entityLabel="Obra"
        searchValue=""
        onSearch={vi.fn()}
        card={{ title: "name", expandToggle: "unidades" }}
        rowActions={(item) => [
          { key: "units", label: "Gerenciar unidades", title: "Gerenciar unidades da obra", ariaLabel: `Gerenciar unidades da obra ${item.name}`, icon: Layers, onSelect: () => units(item) },
        ]}
        expandLabel={(item) => `unidades de ${item.name}`}
        renderExpanded={(item) => <p>Unidades de {item.name}</p>}
      />,
    );
    return handlers;
  }
  const openMenu = (name: string) => userEvent.click(screen.getByRole("button", { name: `Abrir ações de ${name}` }));

  it("Editar, Inativar, Excluir e Gerenciar unidades chamam os mesmos handlers", async () => {
    const h = renderTable(390);
    await openMenu("ATIVA LTDA");
    await userEvent.click(await screen.findByRole("menuitem", { name: "Editar obra" }));
    expect(h.onEdit).toHaveBeenCalledWith(active);
    await openMenu("ATIVA LTDA");
    await userEvent.click(await screen.findByRole("menuitem", { name: "Inativar obra" }));
    expect(h.onToggle).toHaveBeenCalledWith(active);
    await openMenu("ATIVA LTDA");
    await userEvent.click(await screen.findByRole("menuitem", { name: "Excluir permanentemente" }));
    expect(h.onDelete).toHaveBeenCalledWith(active);
    await openMenu("ATIVA LTDA");
    await userEvent.click(await screen.findByRole("menuitem", { name: "Gerenciar unidades" }));
    expect(units).toHaveBeenCalledWith(active);
  });

  it("inativo: Reativar no menu e mesmo tratamento visual da linha", async () => {
    const h = renderTable(390);
    const card = screen.getByRole("heading", { name: "INATIVA LTDA" }).closest("article")!;
    expect(card).toHaveClass("opacity-60");
    await openMenu("INATIVA LTDA");
    await userEvent.click(await screen.findByRole("menuitem", { name: "Reativar obra" }));
    expect(h.onToggle).toHaveBeenCalledWith(inactive);
  });

  it("card não é clicável: só o ⋯ e o expandir são interativos", () => {
    renderTable(390, [active]);
    const card = screen.getByRole("heading", { name: "ATIVA LTDA" }).closest("article")!;
    expect(within(card).getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual([
      "Abrir ações de ATIVA LTDA",
      "Expandir unidades de ATIVA LTDA",
    ]);
  });

  it("expandir unidades: aria-expanded, mesma lista e estado preservado ao trocar de faixa", async () => {
    renderTable(390, [active]);
    const toggle = screen.getByRole("button", { name: "Expandir unidades de ATIVA LTDA" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveClass("min-h-11");
    await userEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Recolher unidades de ATIVA LTDA" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Unidades de ATIVA LTDA")).toBeInTheDocument();
    resizeTo(768);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recolher unidades de ATIVA LTDA" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Unidades de ATIVA LTDA")).toBeInTheDocument();
    resizeTo(390);
    expect(screen.getByText("Unidades de ATIVA LTDA")).toBeInTheDocument();
  });
});

describe("tabela ≥ 768px continua igual", () => {
  it("Obras: botão 'Gerenciar unidades' da linha idêntico ao anterior", async () => {
    width = 1024;
    render(<ObrasPage />);
    const btn = await screen.findByRole("button", { name: "Gerenciar unidades da obra RESIDENCIAL AURORA" });
    expect(btn).toHaveAttribute("title", "Gerenciar unidades da obra");
    expect(btn).toHaveClass(
      "flex", "h-8", "w-8", "items-center", "justify-center", "rounded-lg", "text-zinc-500", "transition",
      "hover:bg-zinc-100", "hover:text-zinc-900", "dark:text-zinc-400", "dark:hover:bg-white/8", "dark:hover:text-foreground",
    );
    const row = btn.closest("tr")!;
    const labels = within(row).getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(labels).toEqual([
      "Expandir unidades de RESIDENCIAL AURORA",
      "Gerenciar unidades da obra RESIDENCIAL AURORA",
      "Editar obra",
      "Inativar obra",
      "Excluir permanentemente",
    ]);
  });

  it("Excluir na tabela ganhou nome acessível, com o mesmo handler (inativação)", async () => {
    width = 1280;
    render(<VendedoresPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Excluir permanentemente" }));
    expect(window.confirm).toHaveBeenCalledWith('Inativar "MARIA SOUZA"?');
    expect(api.setEntityActive).toHaveBeenCalledWith("vendedores", "v1", false);
  });
});
