import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectDetailsDrawer } from "@/features/projects/components/project-details-drawer";
import { ProjectFormModal } from "@/features/projects/components/project-form-modal";
import { useMasterDataStore } from "@/features/master-data/state/master-data-store";
import type { Project } from "@/features/projects/domain/project-types";

// O controle "Marcar como urgente" do drawer (edição) e do formulário (criação)
// só fica disponível com projects.markUrgent — o servidor recusa sem ela.

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
    status_entered_at: "2026-05-03",
    reviewCount: 0,
    reviewHistory: [],
    finalReviewCount: 0,
    finalReviewHistory: [],
    created_at: "2026-05-01",
    updated_at: "2026-05-05",
    ...overrides,
  };
}

function renderDrawer(canMarkUrgent: boolean | undefined, project = makeProject()) {
  render(
    <ProjectDetailsDrawer
      open
      project={project}
      initialMode="edit"
      statusHistory={[]}
      observations={[]}
      onClose={vi.fn()}
      onUpdate={vi.fn(() => Promise.resolve({ ok: true }))}
      isCodigoDuplicado={vi.fn(() => false)}
      onAddObservation={vi.fn()}
      notify={vi.fn()}
      {...(canMarkUrgent === undefined ? {} : { canMarkUrgent })}
    />,
  );
}

function renderCreateForm(canMarkUrgent: boolean) {
  render(
    <ProjectFormModal
      open
      mode="create"
      quickMode={false}
      statusHistory={[]}
      observations={[]}
      onClose={vi.fn()}
      onCreate={vi.fn(() => ({ ok: true }))}
      onUpdate={vi.fn(() => Promise.resolve({ ok: true }))}
      onDelete={vi.fn()}
      onMoveStatus={vi.fn(() => ({ ok: true }))}
      isCodigoDuplicado={vi.fn(() => false)}
      onAddObservation={vi.fn()}
      notify={vi.fn()}
      canMarkUrgent={canMarkUrgent}
    />,
  );
}

const urgencyCheckbox = () => screen.getByRole("checkbox", { name: /Marcar como urgente/ });

beforeEach(() => {
  const base = { active: true, createdAt: "2026-01-01", updatedAt: "2026-01-01", createdBy: "test" };
  useMasterDataStore.setState({
    construtoras: [{ id: "c1", name: "ACRY", ...base }],
    obras: [{ id: "o1", construtoraName: "ACRY", name: "ARTHUR DE AZEVEDO", ...base }],
    equipamentos: [{ id: "e1", code: "EK-15/26", ...base }],
    tiposCabine: [],
    vendedores: [{ id: "v1", name: "RENATO", ...base }],
    engenheiros: [],
    auditLog: [],
  });
});
afterEach(() => cleanup());

describe("drawer (edição)", () => {
  it("sem markUrgent: controle travado, estado atual visível e aviso", () => {
    renderDrawer(false, makeProject({ urgente: true, urgentDeadline: "2099-01-10" }));
    expect(urgencyCheckbox()).toBeDisabled();
    expect(urgencyCheckbox()).toBeChecked();
    expect(screen.getByText("Sem permissão para alterar a urgência.")).toBeInTheDocument();
  });

  it("com markUrgent: comportamento atual (habilitado, sem aviso)", () => {
    renderDrawer(true);
    expect(urgencyCheckbox()).toBeEnabled();
    expect(screen.queryByText("Sem permissão para alterar a urgência.")).not.toBeInTheDocument();
  });

  it("padrão (prop ausente) mantém o comportamento anterior", () => {
    renderDrawer(undefined);
    expect(urgencyCheckbox()).toBeEnabled();
  });
});

describe("formulário (criação)", () => {
  it("sem markUrgent: controle travado com aviso", () => {
    renderCreateForm(false);
    expect(urgencyCheckbox()).toBeDisabled();
    expect(screen.getByText("Sem permissão para alterar a urgência.")).toBeInTheDocument();
  });

  it("com markUrgent: habilitado", () => {
    renderCreateForm(true);
    expect(urgencyCheckbox()).toBeEnabled();
  });
});
