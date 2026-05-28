import { describe, expect, it } from "vitest";
import {
  applyAlignmentAutomation,
  computeOperationalKpis,
  computePrazoBadge,
  computePrazoEntrega,
  transitionStatus,
} from "@/features/projects/domain/project-rules";
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
    data_alinhamento: "2026-05-05",
    status_atual: "ELABORAR ANTE-PROJETO",
    data_previsao: null,
    data_envio: null,
    data_aprovacao: null,
    urgente: false,
    created_at: "2026-05-01",
    updated_at: "2026-05-10",
    ...overrides,
  };
}

describe("project rules", () => {
  it("calcula prazo de entrega com +45 dias", () => {
    expect(computePrazoEntrega("2026-05-01")).toBe("2026-06-15");
  });

  it("recalcula prazo quando data alinhamento muda", () => {
    const oldPrazo = computePrazoEntrega("2026-05-01");
    const newPrazo = computePrazoEntrega("2026-05-10");
    expect(oldPrazo).toBe("2026-06-15");
    expect(newPrazo).toBe("2026-06-24");
  });

  it("nao inicia contagem de prazo sem local da cabine e projeto da obra marcados", () => {
    expect(computePrazoEntrega("2026-05-01", false)).toBeNull();
    expect(computePrazoEntrega("2026-05-01", true)).toBe("2026-06-15");
  });

  it("badge atrasado quando passou da data", () => {
    expect(computePrazoBadge("2026-06-20", "2026-06-15")).toBe("atrasado");
  });

  it("sugere alinhamento quando pre-requisitos estao true", () => {
    const result = applyAlignmentAutomation({
      proj_obra_recebido: true,
      local_cabine_definido: true,
      alinhamento: false,
      data_alinhamento: null,
    });
    expect(result.alinhamentoSuggested).toBe(true);
    expect(result.nextDataAlinhamento).not.toBeNull();
  });

  it("aplica data_envio automaticamente na transicao", () => {
    const result = transitionStatus({
      currentStatus: "ELABORAR ANTE-PROJETO",
      nextStatus: "ANTE-PROJETO ENVIADO",
      aligned: true,
      today: "2026-05-26",
      data_envio: null,
      data_aprovacao: null,
    });
    expect(result.data_envio).toBe("2026-05-26");
  });

  it("calcula KPIs operacionais e estado do SLA", () => {
    const project = makeProject();
    const statusHistory = [
      {
        id: "h1",
        projeto_id: project.id,
        status_de: "CADASTRO INICIAL" as const,
        status_para: "ELABORAR ANTE-PROJETO" as const,
        alterado_em: "2026-05-20",
        origem: "kanban" as const,
      },
    ];

    const kpis = computeOperationalKpis(project, statusHistory, "2026-05-28");

    expect(kpis.diasDesdeCadastro).toBe(27);
    expect(kpis.diasSemAtualizacao).toBe(18);
    expect(kpis.diasNoStatusAtual).toBe(8);
    expect(kpis.slaTargetDias).toBe(10);
    expect(kpis.slaRestanteDias).toBe(2);
    expect(kpis.slaState).toBe("atencao");
  });

  it("marca SLA estourado quando ultrapassa o limite do status", () => {
    const project = makeProject({
      status_atual: "REVISAO DE ESTUDO",
      created_at: "2026-05-01",
    });

    const statusHistory = [
      {
        id: "h2",
        projeto_id: project.id,
        status_de: "PROJETO APROVADO" as const,
        status_para: "REVISAO DE ESTUDO" as const,
        alterado_em: "2026-05-10",
        origem: "formulario" as const,
      },
    ];

    const kpis = computeOperationalKpis(project, statusHistory, "2026-05-20");
    expect(kpis.slaTargetDias).toBe(4);
    expect(kpis.slaRestanteDias).toBe(-6);
    expect(kpis.slaState).toBe("estourado");
  });
});
