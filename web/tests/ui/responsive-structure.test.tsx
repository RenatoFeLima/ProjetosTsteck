import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { Project } from "@/features/projects/domain/project-types";

// Garantias estruturais de responsividade (Fase 1). Não testa CSS visual —
// isso é validado em viewport real —, só as classes que evitam o overflow
// global e a sobreposição de colunas.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({
    session: {
      user: {
        name: "Admin", username: "admin", role: "ADMIN", permissions: getDefaultPermissions("ADMIN"),
        sellerId: null, mustChangePassword: false,
      },
    },
    isLoading: false,
    logout: vi.fn(),
  }),
}));

// A sidebar em si não faz parte desta verificação.
vi.mock("@/features/sidebar/components/app-sidebar", () => ({
  AppSidebar: () => <nav aria-label="Menu de navegação" />,
}));

import MainLayout from "@/app/(main)/layout";
import { ProjectsTable } from "@/features/projects/components/projects-table";
import { MasterDataTable } from "@/features/master-data/components/master-data-table";
import { ProjectsToolbar } from "@/features/projects/components/projects-toolbar";
import { KpiCard } from "@/features/projects/components/kpi-card";
import { FolderKanban } from "lucide-react";

afterEach(() => cleanup());

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    construtora: "ACRY",
    obra: "ARTHUR DE AZEVEDO",
    equipamento: "EK-15/26",
    codigo_projeto: "CRE-000-0001",
    vendedor: "RENATO",
    proj_obra_recebido: true,
    local_cabine_definido: true,
    alinhamento: true,
    data_lancamento: "2026-05-01",
    data_alinhamento: "2026-05-02",
    status_atual: "ANTE-PROJETO ENVIADO",
    status_entered_at: "2026-05-10",
    data_envio: "2026-05-10",
    data_aprovacao: null,
    urgente: false,
    reviewCount: 0,
    reviewHistory: [],
    finalReviewCount: 0,
    finalReviewHistory: [],
    created_at: "2026-05-01",
    updated_at: "2026-05-10",
    ...overrides,
  };
}

describe("shell — largura estrutural", () => {
  it("<main> do layout tem min-w-0 (não cresce com tabelas largas)", () => {
    render(<MainLayout><p>conteúdo</p></MainLayout>);
    const main = screen.getByRole("main");
    expect(main).toHaveClass("min-w-0", "flex-1");
  });
});

describe("tabela de Projetos — colunas por espaço disponível", () => {
  function renderTable() {
    return render(
      <ProjectsTable
        projects={[makeProject()]}
        onViewDetails={vi.fn()}
        onViewHistory={vi.fn()}
        onRemoveUrgente={vi.fn()}
      />,
    );
  }

  it("rolagem horizontal confinada ao wrapper, dentro de um container query", () => {
    renderTable();
    const table = screen.getByRole("table");
    const wrapper = table.parentElement!;
    expect(wrapper).toHaveClass("overflow-x-auto");
    expect(wrapper.parentElement).toHaveClass("@container");
    // Largura mínima garante espaço para Construtora / Obra (sem sobreposição).
    expect(table).toHaveClass("table-fixed", "min-w-[700px]");
  });

  it("colunas essenciais sempre visíveis", () => {
    renderTable();
    for (const name of [/CODIGO/, /CONSTRUTORA \/ OBRA/, /STATUS/, /PRAZO/]) {
      expect(screen.getByRole("columnheader", { name })).not.toHaveClass("hidden");
    }
    expect(screen.getByRole("columnheader", { name: "ACOES" })).not.toHaveClass("hidden");
  });

  it("Vendedor e Prioridade só aparecem com espaço ≥ 940px; Próxima ação com ≥ 1130px", () => {
    renderTable();
    expect(screen.getByRole("columnheader", { name: /VENDEDOR/ })).toHaveClass("hidden", "@min-[940px]:table-cell");
    expect(screen.getByRole("columnheader", { name: "PRIORIDADE" })).toHaveClass("hidden", "@min-[940px]:table-cell");
    expect(screen.getByRole("columnheader", { name: "PROXIMA ACAO" })).toHaveClass("hidden", "@min-[1130px]:table-cell");

    // As células acompanham os cabeçalhos (dados não são removidos, só ocultados).
    const vendedorCell = screen.getByRole("cell", { name: "RENATO" });
    expect(vendedorCell).toHaveClass("hidden", "@min-[940px]:table-cell");
  });
});

describe("toolbar e KPIs — sem esmagar conteúdo", () => {
  it("busca tem largura mínima (a linha quebra em vez de comprimir o campo)", () => {
    render(
      <ProjectsToolbar
        view="table"
        onViewChange={vi.fn()}
        onClearFilters={vi.fn()}
        tabCounts={{ table: 1, kanban: 1, kpis: 1, alerts: 0 }}
        filters={{ search: "", status: "all", construtora: "", obra: "", vendedor: "", equipamento: "", atrasadoOnly: false, urgenteOnly: false }}
        onFiltersChange={vi.fn()}
      />,
    );
    const label = screen.getByRole("textbox", { name: /Buscar por codigo/ }).closest("label")!;
    expect(label).toHaveClass("min-w-[12rem]", "flex-1");
    expect(label.parentElement).toHaveClass("flex-wrap");
  });

  it("abas rolam na horizontal; no mobile a barra de rolagem fica oculta (sem travar o scroll)", () => {
    render(
      <ProjectsToolbar
        view="table"
        onViewChange={vi.fn()}
        onClearFilters={vi.fn()}
        tabCounts={{ table: 1, kanban: 1, kpis: 1, alerts: 0 }}
        filters={{ search: "", status: "all", construtora: "", obra: "", vendedor: "", equipamento: "", atrasadoOnly: false, urgenteOnly: false }}
        onFiltersChange={vi.fn()}
      />,
    );
    const tabsBar = screen.getByRole("button", { name: /Tabela/ }).parentElement!;
    expect(tabsBar).toHaveClass("overflow-x-auto", "max-md:[scrollbar-width:none]", "max-md:[&::-webkit-scrollbar]:hidden");
    expect(tabsBar).not.toHaveClass("overflow-hidden");

    // Teclado: a aba focada é trazida inteira para a área visível da barra.
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    screen.getByRole("button", { name: /Alertas/ }).focus();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest", inline: "nearest" });
  });

  it("título do KPI pode encolher (min-w-0) e o ícone fica no card", () => {
    render(<KpiCard title="Total de Projetos" value="6" icon={FolderKanban} />);
    const title = screen.getByText("Total de Projetos");
    expect(title).toHaveClass("truncate");
    expect(title.parentElement).toHaveClass("min-w-0");
  });
});

describe("tabelas de cadastro — rolagem interna", () => {
  it("MasterDataTable (6 telas de cadastro) rola dentro do próprio container", () => {
    render(
      <MasterDataTable
        items={[{ id: "c1", name: "ACRY", active: true } as never]}
        columns={[{ key: "name", label: "Nome" }]}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        entityLabel="Construtora"
        searchValue=""
        onSearch={vi.fn()}
      />,
    );
    const wrapper = screen.getByRole("table").parentElement!;
    expect(wrapper).toHaveClass("overflow-x-auto");
    expect(wrapper).not.toHaveClass("overflow-hidden");
  });
});
