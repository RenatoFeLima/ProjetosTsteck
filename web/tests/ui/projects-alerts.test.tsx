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
    proj_obra_recebido: false,
    local_cabine_definido: false,
    alinhamento: false,
    data_lancamento: "2026-05-01",
    data_alinhamento: "2026-01-01",
    status_atual: "CADASTRO INICIAL",
    data_previsao: null,
    data_envio: null,
    data_aprovacao: null,
    urgente: false,
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
      proj_obra_recebido: true,
      local_cabine_definido: true,
      alinhamento: true,
      data_alinhamento: "2025-01-01",
      updated_at: "2025-01-01",
    });

    const pendingData = makeProject({
      id: "p-pending",
      codigo_projeto: "PEN-300-0003",
      proj_obra_recebido: false,
      local_cabine_definido: false,
      data_alinhamento: null,
    });

    const review = makeProject({
      id: "p-review",
      codigo_projeto: "REV-200-0002",
      status_atual: "REVISAO DE ESTUDO",
      proj_obra_recebido: true,
      local_cabine_definido: true,
      alinhamento: true,
      data_alinhamento: "2026-05-15",
      updated_at: "2026-05-15",
    });

    render(<ProjectsAlerts projects={[urgent, review, pendingData]} onOpen={onOpen} />);

    expect(screen.getByRole("heading", { name: "Urgentes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Atrasados" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Aguardando documentacao" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Aguardando localizacao da cabine" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Revisao de estudo" })).toBeInTheDocument();
    expect(screen.getAllByText(/Proxima acao:/i).length).toBeGreaterThan(0);

    await user.click(screen.getAllByText("URG-100-0001")[0]);

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "p-urgent" }));
  });

  it("mostra estado vazio quando nao ha alertas", () => {
    render(
      <ProjectsAlerts
        projects={[
          makeProject({
            proj_obra_recebido: true,
            local_cabine_definido: true,
            alinhamento: true,
            urgente: false,
            status_atual: "CADASTRO INICIAL",
            data_alinhamento: null,
            updated_at: "2026-05-27",
          }),
        ]}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getByText(/Nenhum alerta para os filtros atuais/i)).toBeInTheDocument();
  });
});
