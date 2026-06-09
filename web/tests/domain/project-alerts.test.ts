import { describe, expect, it } from "vitest";
import {
  buildAlertGroups,
  countAlerts,
  getAlertedProjects,
} from "@/features/projects/domain/project-alerts";
import type { Project } from "@/features/projects/domain/project-types";

const TODAY = "2026-06-09";

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
    data_alinhamento: "2026-05-01",
    status_atual: "ANTE-PROJETO APROVADO", // sem prazo automático
    status_entered_at: TODAY,
    data_previsao: null,
    data_envio: null,
    data_aprovacao: null,
    urgente: false,
    reviewCount: 0,
    reviewHistory: [],
    finalReviewCount: 0,
    finalReviewHistory: [],
    created_at: "2026-05-01",
    updated_at: TODAY,
    ...overrides,
  };
}

const keys = (projects: Project[]) =>
  buildAlertGroups(projects, TODAY).map((g) => g.key);

describe("regras de alertas", () => {
  it("projeto urgente aparece em Alertas e some ao remover a urgência", () => {
    const urgent = makeProject({ id: "u", urgente: true });
    expect(keys([urgent])).toContain("urgent");
    expect(countAlerts([urgent], TODAY)).toBe(1);

    const normal = { ...urgent, urgente: false };
    expect(keys([normal])).not.toContain("urgent");
    // Sem nenhum outro gatilho, deixa de ser alerta.
    expect(countAlerts([normal], TODAY)).toBe(0);
  });

  it("projeto vencendo hoje aparece (due-today)", () => {
    // REVISAO DE ESTUDO (20d): entrou há 20 dias -> vence hoje.
    const p = makeProject({ status_atual: "REVISAO DE ESTUDO", status_entered_at: "2026-05-20" });
    const k = keys([p]);
    expect(k).toContain("due-today");
    expect(k).not.toContain("overdue");
  });

  it("projeto vencendo em até 7 dias aparece (due-7)", () => {
    const p = makeProject({ status_atual: "REVISAO DE ESTUDO", status_entered_at: "2026-05-25" }); // faltam 5 dias
    expect(keys([p])).toContain("due-7");
  });

  it("projeto atrasado e revisão acima de 20 dias aparecem", () => {
    const p = makeProject({ status_atual: "REVISAO DE ESTUDO", status_entered_at: "2026-05-15" }); // venceu há 5 dias
    const k = keys([p]);
    expect(k).toContain("overdue");
    expect(k).toContain("review-overdue");
    expect(k).toContain("review-study-active");
  });

  it("projeto em Revisão de Projeto Final aparece como informativo", () => {
    const p = makeProject({ status_atual: "REVISAO DE PROJETO FINAL", status_entered_at: TODAY });
    expect(keys([p])).toContain("review-final-active");
  });

  it("Elaborar Ante-Projeto próximo do prazo de 45 dias aparece", () => {
    const p = makeProject({ status_atual: "ELABORAR ANTE-PROJETO", status_entered_at: "2026-05-10" }); // ~14 dias restantes
    expect(keys([p])).toContain("elaborar-near");
  });

  it("cadastro inicial sem alinhamento completo aparece", () => {
    const p = makeProject({ status_atual: "CADASTRO INICIAL", proj_obra_recebido: false, alinhamento: false });
    expect(keys([p])).toContain("cadastro-incompleto");
  });

  it("muitos ciclos de revisão aparece", () => {
    const p = makeProject({ reviewCount: 3 });
    expect(keys([p])).toContain("review-multiple");
  });

  it("o contador conta projetos DISTINTOS (sem duplicar por múltiplos grupos)", () => {
    // Atrasado + em revisão + revisão vencida = 1 projeto, 1 no contador.
    const p = makeProject({ id: "x", status_atual: "REVISAO DE ESTUDO", status_entered_at: "2026-05-15" });
    expect(getAlertedProjects([p], TODAY)).toHaveLength(1);
    expect(countAlerts([p], TODAY)).toBe(1);
  });

  it("respeita a lista filtrada recebida (filtros globais)", () => {
    const urgent = makeProject({ id: "a", urgente: true });
    const calm = makeProject({ id: "b" }); // sem alerta
    expect(countAlerts([urgent, calm], TODAY)).toBe(1);
    // Simula filtro que removeu o urgente:
    expect(countAlerts([calm], TODAY)).toBe(0);
  });
});
