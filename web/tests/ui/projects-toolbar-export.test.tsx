import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectsToolbar } from "@/features/projects/components/projects-toolbar";

afterEach(() => cleanup());

const baseProps = {
  view: "table" as const,
  onViewChange: vi.fn(),
  onClearFilters: vi.fn(),
  tabCounts: { table: 0, kanban: 0, kpis: 0, alerts: 0 },
  filters: {
    search: "",
    status: "all" as const,
    construtora: "",
    obra: "",
    vendedor: "",
    equipamento: "",
    atrasadoOnly: false,
    urgenteOnly: false,
  },
  onFiltersChange: vi.fn(),
};

describe("toolbar — botão Exportar Excel", () => {
  it("8. renderiza o botão e dispara onExport ao clicar", async () => {
    const user = userEvent.setup();
    const onExport = vi.fn();
    render(<ProjectsToolbar {...baseProps} onExport={onExport} />);

    const btn = screen.getByRole("button", { name: /Exportar todos os projetos para Excel/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent(/Exportar Excel/i);

    await user.click(btn);
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("mostra loading e desabilita o botão durante a exportação", () => {
    const onExport = vi.fn();
    render(<ProjectsToolbar {...baseProps} onExport={onExport} exporting />);

    const btn = screen.getByRole("button", { name: /Exportar todos os projetos para Excel/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/Gerando exportação/i);
  });

  it("não renderiza o botão quando onExport não é fornecido", () => {
    render(<ProjectsToolbar {...baseProps} />);
    expect(screen.queryByRole("button", { name: /Exportar todos os projetos para Excel/i })).not.toBeInTheDocument();
  });
});

describe("toolbar — botão Importar Excel", () => {
  it("renderiza o botão e dispara onImport ao clicar", async () => {
    const user = userEvent.setup();
    const onImport = vi.fn();
    render(<ProjectsToolbar {...baseProps} onImport={onImport} />);

    const btn = screen.getByRole("button", { name: /Importar atualizações de projetos via Excel\/CSV/i });
    expect(btn).toHaveTextContent(/Importar Excel/i);

    await user.click(btn);
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it("não renderiza o botão de import quando onImport não é fornecido", () => {
    render(<ProjectsToolbar {...baseProps} />);
    expect(screen.queryByRole("button", { name: /Importar atualizações de projetos/i })).not.toBeInTheDocument();
  });
});
