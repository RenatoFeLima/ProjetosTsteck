import { describe, it, expect } from "vitest";
import { calculateProductionMetrics } from "@/features/projects/domain/production-metrics";
import type { StatusHistoryItem } from "@/features/projects/domain/project-types";

describe("calculateProductionMetrics — métricas de produção do período", () => {
  const baseHistory: StatusHistoryItem[] = [
    {
      id: "h1",
      projeto_id: "p1",
      status_de: "CADASTRO INICIAL",
      status_para: "ANTE-PROJETO ENVIADO",
      alterado_em: "2026-06-05T10:00:00Z",
      origem: "sistema",
    },
    {
      id: "h2",
      projeto_id: "p2",
      status_de: "CADASTRO INICIAL",
      status_para: "ANTE-PROJETO ENVIADO",
      alterado_em: "2026-06-10T14:30:00Z",
      origem: "sistema",
    },
    {
      id: "h3",
      projeto_id: "p1",
      status_de: "ANTE-PROJETO ENVIADO",
      status_para: "PROJETO FINAL ENVIADO",
      alterado_em: "2026-06-15T09:00:00Z",
      origem: "sistema",
    },
    {
      id: "h4",
      projeto_id: "p3",
      status_de: "PROJETO FINAL ENVIADO",
      status_para: "PROJETO APROVADO",
      alterado_em: "2026-06-20T16:45:00Z",
      origem: "sistema",
    },
  ];

  it("evento dentro do período conta", () => {
    const result = calculateProductionMetrics(baseHistory, "2026-06-01", "2026-06-30");
    expect(result.anteProjetosEnviados).toBe(2);
    expect(result.projetosFiaisEnviados).toBe(1);
    expect(result.projetosAprovados).toBe(1);
  });

  it("evento fora do período não conta", () => {
    const result = calculateProductionMetrics(baseHistory, "2026-07-01", "2026-07-31");
    expect(result.anteProjetosEnviados).toBe(0);
    expect(result.projetosFiaisEnviados).toBe(0);
    expect(result.projetosAprovados).toBe(0);
  });

  it("projeto que mudou para outro status depois ainda conta", () => {
    // p1 entrou em ANTE-PROJETO_ENVIADO em 05/06 e depois foi para PROJETO_FINAL_ENVIADO em 15/06
    // Mas apenas PROJETO_FINAL_ENVIADO está no período, então:
    // - ANTE-PROJETO_ENVIADO: 1 evento no período (05/06)
    // - PROJETO_FINAL_ENVIADO: 1 evento no período (15/06)
    const result = calculateProductionMetrics(baseHistory, "2026-06-01", "2026-06-30");
    expect(result.anteProjetosEnviados).toBe(2); // p1 e p2
    expect(result.projetosFiaisEnviados).toBe(1); // p1
  });

  it("múltiplas entradas do mesmo projeto contam como eventos", () => {
    const historyWithReentry: StatusHistoryItem[] = [
      {
        id: "h1",
        projeto_id: "p1",
        status_de: "CADASTRO INICIAL",
        status_para: "ANTE-PROJETO ENVIADO",
        alterado_em: "2026-06-05T10:00:00Z",
        origem: "sistema",
      },
      {
        id: "h2",
        projeto_id: "p1",
        status_de: "ELABORAR ANTE-PROJETO",
        status_para: "ANTE-PROJETO ENVIADO",
        alterado_em: "2026-06-12T14:00:00Z",
        origem: "sistema",
      },
    ];
    const result = calculateProductionMetrics(historyWithReentry, "2026-06-01", "2026-06-30");
    expect(result.anteProjetosEnviados).toBe(2); // 2 eventos
    expect(result.anteProjetosUnicos).toBe(1); // 1 projeto único
  });

  it("projetos únicos calculados separadamente", () => {
    const result = calculateProductionMetrics(baseHistory, "2026-06-01", "2026-06-30");
    expect(result.anteProjetosEnviados).toBe(2); // eventos
    expect(result.anteProjetosUnicos).toBe(2); // projetos únicos: p1 e p2
    expect(result.projetosFiaisEnviados).toBe(1); // eventos
    expect(result.projetosFiaisUnicos).toBe(1); // projetos únicos: p1
  });

  it("sem período filtra sem limite de data", () => {
    const result = calculateProductionMetrics(baseHistory, null, null);
    expect(result.anteProjetosEnviados).toBe(2);
    expect(result.projetosFiaisEnviados).toBe(1);
    expect(result.projetosAprovados).toBe(1);
  });

  it("período com apenas data inicial", () => {
    const result = calculateProductionMetrics(baseHistory, "2026-06-10", null);
    expect(result.anteProjetosEnviados).toBe(1); // apenas p2 em 10/06
    expect(result.projetosFiaisEnviados).toBe(1); // p1 em 15/06
    expect(result.projetosAprovados).toBe(1); // p3 em 20/06
  });

  it("período com apenas data final", () => {
    const result = calculateProductionMetrics(baseHistory, null, "2026-06-12");
    expect(result.anteProjetosEnviados).toBe(2); // p1 e p2 (05/06 e 10/06)
    expect(result.projetosFiaisEnviados).toBe(0); // nada antes de 12/06
    expect(result.projetosAprovados).toBe(0); // nada antes de 12/06
  });

  it("datas limites inclusivas", () => {
    const result = calculateProductionMetrics(baseHistory, "2026-06-05", "2026-06-05");
    expect(result.anteProjetosEnviados).toBe(1); // apenas p1 em 05/06
    expect(result.projetosFiaisEnviados).toBe(0);
    expect(result.projetosAprovados).toBe(0);
  });

  it("retorna zeros quando não há eventos", () => {
    const result = calculateProductionMetrics([], "2026-06-01", "2026-06-30");
    expect(result.anteProjetosEnviados).toBe(0);
    expect(result.anteProjetosUnicos).toBe(0);
    expect(result.projetosFiaisEnviados).toBe(0);
    expect(result.projetosFiaisUnicos).toBe(0);
    expect(result.projetosAprovados).toBe(0);
    expect(result.projetosAprovadosUnicos).toBe(0);
  });
});
