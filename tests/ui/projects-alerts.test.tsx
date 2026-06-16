import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectsAlerts } from "@/features/projects/components/projects-alerts";
import type { Project } from "@/features/projects/domain/project-types";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    construtora: "ACRY",
    obra: "ARTHUR DE AZEVEDO",
    engenheiro_nome: "",
    engenheiro_celular: "",
    equipamento: "EK-15/26",
    tipo_cabine: "",
    codigo_projeto: "ABC-123-4567",
    vendedor: "RENATO",
    proj_obra_recebido: true,
    local_cabine_definido: true,
    alinhamento: true,
    data_lancamento: "2026-05-01",
    data_alinhamento: "2026-01-01",
    status_atual: "CADASTRO INICIAL",
    status_entered_at: "2026-05-01",
    data_previsao: null,
    data_envio: null,
    data_aprovacao: null,
    urgente: false,
    reviewCount: 0,
    reviewHistory: [],
    finalReviewCount: 0,
    finalReviewHistory: [],
    created_at: "2026-05-01",
    updated_at: "2026-05-01",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("projects alerts", () => {
  it("renderiza grupos de risco e abre projeto ao clicar no card", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    const urgent = makeProject({
      id: "p-urgent",
      codigo_projeto: "URG-100-0001",
      urgente: true,
      updated_at: "2025-01-01",
    });

    const cadastroIncompleto = makeProject({
      id: "p-pending",
      codigo_projeto: "PEN-300-0003",
      proj_obra_recebido: false,
      local_cabine_definido: false,
      alinhamento: false,
    });

    const review = makeProject({
      id: "p-review",
      codigo_projeto: "REV-200-0002",
      status_atual: "REVISAO DE ESTUDO",
      status_entered_at: "2026-01-01",
    });

    render(<ProjectsAlerts projects={[urgent, review, cadastroIncompleto]} onOpen={onOpen} />);

    expect(screen.getByRole("heading", { name: "Urgentes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Atrasados" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Em Revisão de Estudo" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Cadastro inicial sem alinhamento completo" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Próxima ação:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ação recomendada:/i).length).toBeGreaterThan(0);

    await user.click(screen.getAllByText("URG-100-0001")[0]);

    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "p-urgent" }));
  });

  it("mostra estado vazio quando nao ha alertas", () => {
    const hoje = new Date().toISOString().slice(0, 10);
    render(
      <ProjectsAlerts
        projects={[
          makeProject({
            proj_obra_recebido: true,
            local_cabine_definido: true,
            alinhamento: true,
            urgente: false,
            status_atual: "ANTE-PROJETO APROVADO",
            updated_at: hoje,
          }),
        ]}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText(/Nenhum alerta no momento/i)).toBeInTheDocument();
  });

  it("mostra loading e error states", () => {
    const { rerender } = render(<ProjectsAlerts projects={[]} onOpen={vi.fn()} loading />);
    expect(screen.queryByText(/Nenhum alerta no momento/i)).not.toBeInTheDocument();

    rerender(<ProjectsAlerts projects={[]} onOpen={vi.fn()} error onRetry={vi.fn()} />);
    expect(screen.getByText(/Não foi possível carregar os alertas/i)).toBeInTheDocument();
  });
});
