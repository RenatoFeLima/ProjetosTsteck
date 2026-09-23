// Toolbar de Projetos — seletor "Filtrar por tipo de cabine".
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsToolbar } from "@/features/projects/components/projects-toolbar";
import { useMasterDataStore } from "@/features/master-data/state/master-data-store";
import { useProjectsStore } from "@/features/projects/state/projects-store";
import type { Project } from "@/features/projects/domain/project-types";
import type { TipoCabine } from "@/features/master-data/domain/master-data-types";

function tipo(id: string, name: string, active: boolean): TipoCabine {
  return { id, name, active, createdAt: "2026-01-01", updatedAt: "2026-01-01" } as TipoCabine;
}

const TIPOS: TipoCabine[] = [
  tipo("ct-simples", "Simples", true),
  tipo("ct-simples-co", "Simples + C.o", true),
  tipo("ct-dupla", "Dupla", true),
  tipo("ct-especial", "Especial", true),
  tipo("ct-legado", "Modelo Legado", false), // inativo COM projeto
  tipo("ct-orfao", "Modelo Sem Uso", false), // inativo SEM projeto
];

const baseFilters = {
  search: "",
  status: "all" as const,
  construtora: "",
  obra: "",
  vendedor: "",
  equipamento: "",
  tipoCabineId: "",
  atrasadoOnly: false,
  urgenteOnly: false,
};

function renderToolbar(filters: Partial<typeof baseFilters> = {}) {
  const onFiltersChange = vi.fn();
  render(
    <ProjectsToolbar
      view="table"
      onViewChange={vi.fn()}
      onClearFilters={vi.fn()}
      tabCounts={{ table: 0, kanban: 0, kpis: 0, alerts: 0 }}
      filters={{ ...baseFilters, ...filters }}
      onFiltersChange={onFiltersChange}
    />,
  );
  return { onFiltersChange, user: userEvent.setup({ delay: null }) };
}

async function openAdvanced(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Filtros/ }));
}

beforeEach(() => {
  useMasterDataStore.setState({ tiposCabine: TIPOS });
  useProjectsStore.setState({
    projects: [
      { id: "p1", tipo_cabine_id: "ct-simples" },
      { id: "p2", tipo_cabine_id: "ct-legado" },
      { id: "p3", tipo_cabine_id: null },
    ] as Project[],
  });
});

afterEach(() => cleanup());

describe("posição e aparência", () => {
  it("fica no painel de filtros, logo após 'Apenas urgentes'", async () => {
    const { user } = renderToolbar();
    await openAdvanced(user);

    const trigger = screen.getByRole("button", { name: "Filtrar por tipo de cabine" });
    expect(trigger).toHaveTextContent("Filtrar por tipo de cabine");

    // Mesmo contêiner de grade dos demais filtros (sem criar linha nova).
    const urgentes = screen.getByText("Apenas urgentes").closest("label") as HTMLElement;
    const grid = urgentes.parentElement as HTMLElement;
    expect(grid.className).toContain("xl:grid-cols-4");
    const children = Array.from(grid.children);
    const urgentesIdx = children.indexOf(urgentes);
    expect(children[urgentesIdx + 1].contains(trigger)).toBe(true);
    // 7 itens numa grade de 4 colunas → 2 linhas no desktop.
    expect(children).toHaveLength(7);
  });
});

describe("opções", () => {
  it("lista ativos e o inativo vinculado com '(inativo)'; omite inativo sem projeto", async () => {
    const { user } = renderToolbar();
    await openAdvanced(user);
    await user.click(screen.getByRole("button", { name: "Filtrar por tipo de cabine" }));

    const listbox = screen.getByRole("listbox");
    const labels = within(listbox).getAllByRole("option").map((o) => o.textContent?.trim());
    expect(labels).toEqual([
      "Dupla",
      "Especial",
      "Simples",
      "Simples + C.o",
      "Modelo Legado (inativo)",
    ]);
    expect(labels).not.toContain("Modelo Sem Uso (inativo)");
  });

  it("busca case-insensitive: 'simp' encontra Simples e Simples + C.o", async () => {
    const { user } = renderToolbar();
    await openAdvanced(user);
    await user.click(screen.getByRole("button", { name: "Filtrar por tipo de cabine" }));
    await user.type(screen.getByRole("combobox", { name: "Buscar tipo de cabine..." }), "SIMP");

    const labels = within(screen.getByRole("listbox"))
      .getAllByRole("option")
      .map((o) => o.textContent?.trim());
    expect(labels).toEqual(["Simples", "Simples + C.o"]);
  });
});

describe("seleção e limpeza", () => {
  it("selecionar envia o ID (não o nome) e preserva os outros filtros", async () => {
    const { user, onFiltersChange } = renderToolbar();
    await openAdvanced(user);
    await user.click(screen.getByRole("button", { name: "Filtrar por tipo de cabine" }));
    await user.click(within(screen.getByRole("listbox")).getByRole("option", { name: /^Dupla$/ }));

    // Patch parcial: só o tipo muda — o store faz merge com os demais filtros.
    expect(onFiltersChange).toHaveBeenCalledWith({ tipoCabineId: "ct-dupla" });
  });

  it("com um tipo selecionado, mostra o nome no botão", async () => {
    const { user } = renderToolbar({ tipoCabineId: "ct-especial" });
    await openAdvanced(user);
    expect(screen.getByRole("button", { name: "Filtrar por tipo de cabine" })).toHaveTextContent(
      "Especial",
    );
  });

  it("limpar volta para vazio sem mexer nos outros filtros", async () => {
    const { user, onFiltersChange } = renderToolbar({ tipoCabineId: "ct-dupla", vendedor: "VENDEDOR A" });
    await openAdvanced(user);
    const trigger = screen.getByRole("button", { name: "Filtrar por tipo de cabine" });
    await user.click(within(trigger).getByRole("button", { name: "Limpar selecao" }));

    expect(onFiltersChange).toHaveBeenCalledWith({ tipoCabineId: "" });
    expect(onFiltersChange).not.toHaveBeenCalledWith(expect.objectContaining({ vendedor: "" }));
  });

  it("tipo selecionado que foi inativado continua visível no filtro", async () => {
    const { user } = renderToolbar({ tipoCabineId: "ct-orfao" });
    await openAdvanced(user);
    expect(screen.getByRole("button", { name: "Filtrar por tipo de cabine" })).toHaveTextContent(
      "Modelo Sem Uso (inativo)",
    );
  });
});

describe("contador do botão 'Filtros'", () => {
  it("conta o tipo de cabine como um filtro ativo", () => {
    renderToolbar({ tipoCabineId: "ct-simples" });
    expect(screen.getByRole("button", { name: /^Filtros/ })).toHaveTextContent("1");
  });

  it("soma com os filtros existentes", () => {
    renderToolbar({ tipoCabineId: "ct-simples", vendedor: "VENDEDOR A", urgenteOnly: true });
    expect(screen.getByRole("button", { name: /^Filtros/ })).toHaveTextContent("3");
  });
});
