import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ProjectsKpiDashboard } from "@/features/projects/components/projects-kpi-dashboard";
import type { Project } from "@/features/projects/domain/project-types";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "kpi-1",
    construtora: "ACRY",
    obra: "ARTHUR DE AZEVEDO",
    engenheiro_nome: "",
    engenheiro_celular: "",
    equipamento: "EK-15/26",
    tipo_cabine: "",
    codigo_projeto: "KPI-100-0001",
    vendedor: "RENATO",
    proj_obra_recebido: true,
    local_cabine_definido: true,
    alinhamento: true,
    data_lancamento: "2026-05-01",
    data_alinhamento: "2026-05-05",
    status_atual: "ELABORAR ANTE-PROJETO",
    data_previsao: null,
    data_envio: null,
    data_aprovacao: null,
    urgente: false,
    created_at: "2026-05-01",
    updated_at: "2026-05-10",
    ...overrides,
  };
}

describe("projects kpi dashboard", () => {
  it("nao quebra ao limpar filtros de data", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ProjectsKpiDashboard
        projects={[makeProject()]}
        statusHistory={[]}
      />,
    );

    const dateInputs = container.querySelectorAll("input[type='date']");
    expect(dateInputs.length).toBe(2);

    fireEvent.change(dateInputs[0], { target: { value: "2026-05-01" } });
    fireEvent.change(dateInputs[1], { target: { value: "2026-05-31" } });

    const clearButtons = screen.getAllByRole("button", { name: /Limpar data/i });
    await user.click(clearButtons[0]);
    await user.click(clearButtons[1]);

    expect(screen.getByText(/Periodo analisado: Todos os periodos/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Dashboard de Projetos/i })).toBeInTheDocument();
  });
});
