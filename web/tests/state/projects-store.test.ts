import { describe, expect, it } from "vitest";
import { useProjectsStore } from "@/features/projects/state/projects-store";
import type { Project } from "@/features/projects/domain/project-types";

// A base inicia vazia (sem seed). Fixture local para o teste de histórico.
function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "fixture-ante",
    construtora: "ACRY",
    obra: "ARTHUR DE AZEVEDO",
    equipamento: "EK-15/26",
    codigo_projeto: "ANTE-000-0001",
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

describe("projects store", () => {
  it("cria projeto com status inicial", () => {
    const result = useProjectsStore.getState().createProject({
      construtora: "Teste",
      obra: "Obra Teste",
      codigo_projeto: "UNIQUE-CODE-001",
      vendedor: "RENATO",
      equipamento: "EK-15/26",
      data_lancamento: "2026-05-26",
    });

    expect(result.ok).toBe(true);
    const created = useProjectsStore
      .getState()
      .projects.find((project) => project.codigo_projeto === "UNIQUE-CODE-001");
    expect(created?.status_atual).toBe("CADASTRO INICIAL");
  });

  it("registra historico ao mover status", () => {
    const project = makeProject();
    useProjectsStore.setState((s) => ({ projects: [...s.projects, project] }));
    const result = useProjectsStore
      .getState()
      .moveStatus(project.id, "REVISAO DE ESTUDO", "kanban");

    expect(result.ok).toBe(true);
    const history = useProjectsStore
      .getState()
      .statusHistory.filter((item) => item.projeto_id === project.id);
    expect(history.length).toBeGreaterThan(0);
  });

  it("observacoes sao append-only", () => {
    const project = useProjectsStore.getState().projects[0];
    useProjectsStore.getState().addObservation(project.id, "Primeira", "user");
    useProjectsStore.getState().addObservation(project.id, "Segunda", "user");

    const observations = useProjectsStore.getState().getProjectObservations(project.id);
    expect(observations.length).toBeGreaterThanOrEqual(2);
  });
});
