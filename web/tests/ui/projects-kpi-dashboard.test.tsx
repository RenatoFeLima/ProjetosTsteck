import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ProjectsKpiDashboard } from "@/features/projects/components/projects-kpi-dashboard";
import type { Project } from "@/features/projects/domain/project-types";

afterEach(() => cleanup());

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
    status_entered_at: "2026-05-05",
    reviewCount: 0,
    reviewHistory: [],
    finalReviewCount: 0,
    finalReviewHistory: [],
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

  it("agrupa os KPIs nos 4 blocos rotulados", () => {
    render(<ProjectsKpiDashboard projects={[makeProject()]} statusHistory={[]} />);

    // Cada bloco tem um heading próprio.
    expect(screen.getByRole("heading", { name: /^Produção do Período$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Carteira Atual$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Risco Operacional$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Eficiência \/ SLA$/i })).toBeInTheDocument();
  });

  it("renomeia 'Projetos Finalizados' para 'Aprovados atualmente' (evita conflito com finais enviados)", () => {
    render(<ProjectsKpiDashboard projects={[makeProject()]} statusHistory={[]} />);

    expect(screen.getByText(/^Aprovados atualmente$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Projetos Finalizados$/i)).not.toBeInTheDocument();
    // Card de carteira que reflete o status atual Projeto Final Enviado.
    expect(screen.getByText(/^Em Projeto Final Enviado$/i)).toBeInTheDocument();
  });

  it("marca o bloco de produção como do período e os demais como situação atual", () => {
    render(<ProjectsKpiDashboard projects={[makeProject()]} statusHistory={[]} />);

    // Sem período selecionado, o chip de produção mostra "Todos os periodos".
    expect(screen.getByText(/Período: Todos os periodos/i)).toBeInTheDocument();
    // Carteira/Risco/Eficiência usam o chip "Situação atual" (3 blocos).
    expect(screen.getAllByText(/Situação atual/i).length).toBe(3);
  });
});
