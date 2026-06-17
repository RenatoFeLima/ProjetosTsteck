import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectsTable } from "@/features/projects/components/projects-table";
import { UrgencyJustificationDialog } from "@/features/projects/components/urgency-justification-dialog";
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

  // Contrato atual: a tabela apenas sinaliza a intenção de marcar urgência
  // chamando onMarkUrgente(project). O modal de prazo/justificativa é renderizado
  // pelo ProjectsPageShell (fora da árvore da tabela), não pela própria tabela.
  it("marcar como urgente apenas dispara onMarkUrgente(project); o modal fica no shell", async () => {
    const user = userEvent.setup();
    const project = makeProject();
    const onMarkUrgente = vi.fn();

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

    // A tabela passa o Project (não um payload) e não renderiza o modal de urgência.
    expect(onMarkUrgente).toHaveBeenCalledTimes(1);
    expect(onMarkUrgente).toHaveBeenCalledWith(project);
    expect(screen.queryByText(/Definir prazo de urgência/i)).not.toBeInTheDocument();
  });

  it("PROJETO APROVADO desabilita a ação de marcar urgência", async () => {
    const user = userEvent.setup();
    const project = makeProject({ status_atual: "PROJETO APROVADO", id: "p-aprovado" });
    const onMarkUrgente = vi.fn();

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
    expect(item).toHaveAttribute("data-disabled");

    await user.click(item);
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

// Modal de urgência (renderizado pelo shell). Prazo é obrigatório; motivo é opcional.
describe("urgency justification dialog", () => {
  const project = {
    id: "p1",
    codigo_projeto: "ABC-123-4567",
    construtora: "ACRY",
    obra: "ARTHUR DE AZEVEDO",
  };

  it("usa o título 'Definir prazo de urgência' e exige apenas prazo", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(<UrgencyJustificationDialog open project={project} onCancel={vi.fn()} onConfirm={onConfirm} />);

    expect(screen.getByText(/Definir prazo de urgência/i)).toBeInTheDocument();

    const confirmButton = screen.getByRole("button", { name: /Confirmar urgência/i });
    expect(confirmButton).toBeDisabled();

    // Confirma com prazo e sem motivo — deve funcionar.
    fireEvent.change(screen.getByLabelText(/Novo prazo de entrega/i), { target: { value: "2026-12-31" } });
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toMatchObject({
      projectId: "p1",
      urgentDeadline: "2026-12-31",
    });
  });

  it("confirma com prazo + motivo quando motivo for preenchido", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(<UrgencyJustificationDialog open project={project} onCancel={vi.fn()} onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText(/Novo prazo de entrega/i), { target: { value: "2026-12-31" } });
    fireEvent.change(screen.getByLabelText(/Motivo da urgência/i), { target: { value: "Cliente solicitou prioridade." } });

    await user.click(screen.getByRole("button", { name: /Confirmar urgência/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toMatchObject({
      urgencyReason: "Cliente solicitou prioridade.",
      urgentDeadline: "2026-12-31",
    });
  });

  it("sem prazo mantém o botão desabilitado", () => {
    const onConfirm = vi.fn();
    render(<UrgencyJustificationDialog open project={project} onCancel={vi.fn()} onConfirm={onConfirm} />);
    expect(screen.getByRole("button", { name: /Confirmar urgência/i })).toBeDisabled();
  });

  it("confirma com apenas prazo — urgencyReason fica string vazia (motivo é opcional)", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(<UrgencyJustificationDialog open project={project} onCancel={vi.fn()} onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText(/Novo prazo de entrega/i), { target: { value: "2026-12-31" } });

    await user.click(screen.getByRole("button", { name: /Confirmar urgência/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toMatchObject({
      projectId: "p1",
      urgentDeadline: "2026-12-31",
      urgencyReason: "",
    });
  });
});
