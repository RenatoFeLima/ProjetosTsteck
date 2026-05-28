import { describe, expect, it } from "vitest";
import { useProjectsStore } from "@/features/projects/state/projects-store";

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
    const project = useProjectsStore
      .getState()
      .projects.find((item) => item.alinhamento);
    if (!project) throw new Error("Seed deve conter projeto alinhado");
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
