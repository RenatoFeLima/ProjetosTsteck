import { describe, expect, it } from "vitest";
import { validateKpiReport, type KpiReportViewModel } from "@/features/projects/domain/kpi-report";

function fullViewModel(): KpiReportViewModel {
  return {
    meta: {
      periodo: "01/06/2026 a 30/06/2026",
      emitidoEm: "2026-07-08T10:00:00.000Z",
      geradoPor: "Renato",
      filtros: ["Status: ELABORAR ANTE-PROJETO"],
      projetosConsiderados: 42,
    },
    producaoPeriodo: [{ label: "Ante-projetos", value: "12", subtitle: "10 únicos" }],
    carteiraAtual: [{ label: "Total", value: "42" }],
    riscoOperacional: [{ label: "Atrasados", value: "3", base: "Base: 8 em status com SLA" }],
    eficienciaSla: [{ label: "SLA", value: "87.5%" }],
    insights: ["Insight 1"],
    gargalos: {
      permanenciaMedia: "ELABORAR ANTE-PROJETO (5.0 dias)",
      concentracaoAtual: "ANTE-PROJETO ENVIADO (10 projetos)",
      semMovimentacao: "4",
      urgentesSemAvancar: "1",
      acaoRecomendada: "Priorizar...",
    },
    revisoes: [
      { titulo: "Revisão de Estudo", total: 5, projetosComRevisao: 3, mediaPorProjeto: "1.7", emRevisaoAgora: 2, vencidas: 1, ranking: ["ACRY — 3 rev."] },
    ],
    projetosAtencao: { totalItens: 30, rows: [{ codigo: "P-1", construtoraObra: "ACRY / OBRA", vendedor: "R", status: "REVISAO DE ESTUDO", diasNoStatus: 12, prioridade: "Urgente", motivo: "Parado", acao: "Escalar" }] },
  };
}

describe("validateKpiReport — saneamento do payload cliente→server", () => {
  it("preserva um view model completo e válido", () => {
    const vm = validateKpiReport(fullViewModel());
    expect(vm.meta.projetosConsiderados).toBe(42);
    expect(vm.producaoPeriodo).toHaveLength(1);
    expect(vm.producaoPeriodo[0].subtitle).toBe("10 únicos");
    expect(vm.riscoOperacional[0].base).toBe("Base: 8 em status com SLA");
    expect(vm.revisoes[0].titulo).toBe("Revisão de Estudo");
    expect(vm.projetosAtencao.totalItens).toBe(30);
    expect(vm.projetosAtencao.rows[0].codigo).toBe("P-1");
  });

  it("nunca lança e devolve defaults para entrada inválida", () => {
    expect(() => validateKpiReport(null)).not.toThrow();
    expect(() => validateKpiReport("lixo")).not.toThrow();
    expect(() => validateKpiReport(42)).not.toThrow();
    const vm = validateKpiReport({});
    expect(vm.meta.periodo).toBe("Todos os períodos");
    expect(vm.producaoPeriodo).toEqual([]);
    expect(vm.insights).toEqual([]);
    expect(vm.projetosAtencao.rows).toEqual([]);
  });

  it("descarta campos desconhecidos/sensíveis do payload (não são renderizados)", () => {
    const malicious = {
      ...fullViewModel(),
      token: "secreto-abc",
      databaseUrl: "mysql://user:pass@host",
      producaoPeriodo: [{ label: "Card", value: "1", passwordHash: "$2b$xxxx", internalId: "uuid-123" }],
    };
    const vm = validateKpiReport(malicious) as unknown as Record<string, unknown>;
    // Campos fora do schema não aparecem no resultado.
    expect(vm.token).toBeUndefined();
    expect(vm.databaseUrl).toBeUndefined();
    const card = (vm.producaoPeriodo as Record<string, unknown>[])[0];
    expect(card.passwordHash).toBeUndefined();
    expect(card.internalId).toBeUndefined();
    expect(card.label).toBe("Card");
    expect(card.value).toBe("1");
  });

  it("limita a quantidade de linhas da tabela (máx. 50)", () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({
      codigo: `P-${i}`,
      construtoraObra: "X / Y",
      vendedor: "V",
      status: "S",
      diasNoStatus: i,
      prioridade: "Normal",
      motivo: "m",
      acao: "a",
    }));
    const vm = validateKpiReport({ projetosAtencao: { totalItens: 200, rows } });
    expect(vm.projetosAtencao.rows.length).toBe(50);
    expect(vm.projetosAtencao.totalItens).toBe(200); // total preservado para "X de Y"
  });

  it("descarta cards sem label ou value", () => {
    const vm = validateKpiReport({
      producaoPeriodo: [{ label: "ok", value: "1" }, { label: "sem valor" }, { value: "sem label" }, "lixo"],
    });
    expect(vm.producaoPeriodo).toHaveLength(1);
    expect(vm.producaoPeriodo[0].label).toBe("ok");
  });
});
