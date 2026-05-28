import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectDetailsDrawer } from "@/features/projects/components/project-details-drawer";
import type { Project, ProjectObservation, StatusHistoryItem } from "@/features/projects/domain/project-types";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    construtora: "ACRY",
    obra: "ARTHUR DE AZEVEDO",
    engenheiro_nome: "Eng Renato",
    engenheiro_celular: "",
    equipamento: "EK-15/26",
    tipo_cabine: "",
    codigo_projeto: "ABC-123-4567",
    vendedor: "RENATO",
    proj_obra_recebido: true,
    local_cabine_definido: true,
    alinhamento: true,
    data_lancamento: "2026-05-01",
    data_alinhamento: "2026-05-03",
    status_atual: "ELABORAR ANTE-PROJETO",
    data_previsao: null,
    data_envio: null,
    data_aprovacao: null,
    urgente: false,
    created_at: "2026-05-01",
    updated_at: "2026-05-05",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("project details drawer", () => {
  it("renderiza timeline consolidada e salva observacao rapida", async () => {
    const user = userEvent.setup();
    const project = makeProject();

    const statusHistory: StatusHistoryItem[] = [
      {
        id: "h1",
        projeto_id: project.id,
        status_de: "CADASTRO INICIAL",
        status_para: "ELABORAR ANTE-PROJETO",
        alterado_em: "2026-05-06T10:00:00.000Z",
        origem: "kanban",
      },
    ];

    const observations: ProjectObservation[] = [
      {
        id: "o1",
        projeto_id: project.id,
        usuario: "usuario.local",
        texto: "Cliente pediu prioridade no estudo.",
        criado_em: "2026-05-07T11:00:00.000Z",
      },
    ];

    const onAddObservation = vi.fn();
    const notify = vi.fn();

    render(
      <ProjectDetailsDrawer
        open
        project={project}
        statusHistory={statusHistory}
        observations={observations}
        onClose={vi.fn()}
        onUpdate={vi.fn(() => ({ ok: true }))}
        isCodigoDuplicado={vi.fn(() => false)}
        onAddObservation={onAddObservation}
        notify={notify}
      />,
    );

    expect(screen.getByText("Timeline operacional")).toBeInTheDocument();
    expect(screen.getByText("KPIs operacionais")).toBeInTheDocument();
    expect(screen.getByText("Tempo no status atual")).toBeInTheDocument();
    expect(screen.getByText("SLA status")).toBeInTheDocument();
    expect(screen.getByText(/CADASTRO INICIAL -> ELABORAR ANTE-PROJETO/i)).toBeInTheDocument();
    expect(screen.getByText(/Cliente pediu prioridade no estudo/i)).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/Registrar contexto/i), "  Pendencia com fornecedor  ");
    await user.click(screen.getByRole("button", { name: /Salvar observacao/i }));

    expect(onAddObservation).toHaveBeenCalledTimes(1);
    expect(onAddObservation).toHaveBeenCalledWith("p1", "Pendencia com fornecedor");
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/Observacao registrada/i));
  });
});
