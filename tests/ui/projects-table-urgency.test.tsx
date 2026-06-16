import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectsTable } from "@/features/projects/components/projects-table";
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
    data_lancamento: "2026-05-27",
    data_alinhamento: null,
    status_atual: "CADASTRO INICIAL",
    data_previsao: null,
    data_envio: null,
    data_aprovacao: null,
    urgente: false,
    status_entered_at: "2026-05-27",
    reviewCount: 0,
    reviewHistory: [],
    finalReviewCount: 0,
    finalReviewHistory: [],
    created_at: "2026-05-27",
    updated_at: "2026-05-27",
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("projects table urgency flow", () => {
  it("dispara callbacks distintos para cada acao do menu", async () => {
    const user = userEvent.setup();
    const project = makeProject({ id: "p-actions", codigo_projeto: "ACT-100-0001" });
    const onViewDetails = vi.fn();
    const onEditProject = vi.fn();
    const onChangeStatus = vi.fn();
    const onViewHistory = vi.fn();

    render(
      <ProjectsTable
        projects={[project]}
        onViewDetails={onViewDetails}
        onEditProject={onEditProject}
        onChangeStatus={onChangeStatus}
        onViewHistory={onViewHistory}
        onMarkUrgente={vi.fn()}
        onRemoveUrgente={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Abrir acoes do projeto/i }));
    await user.click(screen.getByRole("menuitem", { name: /Ver detalhes/i }));
    expect(onViewDetails).toHaveBeenCalledWith(project);

    await user.click(screen.getByRole("button", { name: /Abrir acoes do projeto/i }));
    await user.click(screen.getByRole("menuitem", { name: /Editar projeto/i }));
    expect(onEditProject).toHaveBeenCalledWith(project);

    await user.click(screen.getByRole("button", { name: /Abrir acoes do projeto/i }));
    await user.click(screen.getByRole("menuitem", { name: /Alterar status/i }));
    expect(onChangeStatus).toHaveBeenCalledWith(project);

    await user.click(screen.getByRole("button", { name: /Abrir acoes do projeto/i }));
    await user.click(screen.getByRole("menuitem", { name: /Ver historico/i }));
    expect(onViewHistory).toHaveBeenCalledWith(project);
  });

  it("chama onMarkUrgente com o projeto ao clicar em Marcar como urgente", async () => {
    const user = userEvent.setup();
    const onMarkUrgente = vi.fn();
    const project = makeProject();

    render(
      <ProjectsTable
        projects={[project]}
        onViewDetails={vi.fn()}
        onEditProject={vi.fn()}
        onChangeStatus={vi.fn()}
        onViewHistory={vi.fn()}
        onMarkUrgente={onMarkUrgente}
        onRemoveUrgente={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Abrir acoes do projeto/i }));
    await user.click(screen.getByRole("menuitem", { name: /Marcar como urgente/i }));

    // A tabela agora delega o dialog ao shell — apenas repassa o projeto
    expect(onMarkUrgente).toHaveBeenCalledTimes(1);
    expect(onMarkUrgente).toHaveBeenCalledWith(project);
  });

  it("item Marcar como urgente desabilitado em PROJETO APROVADO", async () => {
    const user = userEvent.setup();
    const onMarkUrgente = vi.fn();
    const project = makeProject({ status_atual: "PROJETO APROVADO" });

    render(
      <ProjectsTable
        projects={[project]}
        onViewDetails={vi.fn()}
        onEditProject={vi.fn()}
        onChangeStatus={vi.fn()}
        onViewHistory={vi.fn()}
        onMarkUrgente={onMarkUrgente}
        onRemoveUrgente={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Abrir acoes do projeto/i }));
    const item = screen.getByRole("menuitem", { name: /Marcar como urgente/i });
    // Radix renderiza disabled via aria-disabled
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(onMarkUrgente).not.toHaveBeenCalled();
  });

  it("pede confirmacao antes de remover urgencia", async () => {
    const user = userEvent.setup();
    const project = makeProject({ urgente: true, id: "p2", codigo_projeto: "ZZZ-111-2222" });
    const onRemoveUrgente = vi.fn();

    render(
      <ProjectsTable
        projects={[project]}
        onViewDetails={vi.fn()}
        onEditProject={vi.fn()}
        onChangeStatus={vi.fn()}
        onViewHistory={vi.fn()}
        onMarkUrgente={vi.fn()}
        onRemoveUrgente={onRemoveUrgente}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: /Abrir acoes do projeto/i })[0]);
    await user.click(screen.getByRole("menuitem", { name: /Remover urgencia/i }));

    expect(screen.getByText(/Remover prioridade urgente\?/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Remover urgencia$/i }));

    expect(onRemoveUrgente).toHaveBeenCalledWith(project);
  });
});
