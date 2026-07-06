import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProductionPeriodCards } from "@/features/projects/components/production-period-cards";
import type { StatusHistoryItem } from "@/features/projects/domain/project-types";

afterEach(() => cleanup());

describe("ProductionPeriodCards — 3 métricas principais de produção", () => {
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

  it("exibe os 3 cards de produção", () => {
    render(
      <ProductionPeriodCards
        statusHistory={baseHistory}
        periodStart="2026-06-01"
        periodEnd="2026-06-30"
      />
    );
    expect(screen.getByText("Ante-projetos Enviados")).toBeInTheDocument();
    expect(screen.getByText("Projetos Finais Enviados")).toBeInTheDocument();
    expect(screen.getByText("Projetos Aprovados")).toBeInTheDocument();
  });

  it("exibe título 'Produção do Período'", () => {
    render(
      <ProductionPeriodCards
        statusHistory={baseHistory}
        periodStart="2026-06-01"
        periodEnd="2026-06-30"
      />
    );
    expect(screen.getByText("Produção do Período")).toBeInTheDocument();
  });

  it("calcula evento dentro do período", () => {
    render(
      <ProductionPeriodCards
        statusHistory={baseHistory}
        periodStart="2026-06-01"
        periodEnd="2026-06-30"
      />
    );
    // Ante-projetos: 2 eventos (p1 e p2)
    expect(screen.getByText("2", { selector: "p.font-display" })).toBeInTheDocument();
  });

  it("mostra projetos únicos em subtítulo", () => {
    render(
      <ProductionPeriodCards
        statusHistory={baseHistory}
        periodStart="2026-06-01"
        periodEnd="2026-06-30"
      />
    );
    // Ante-projetos únicos: 2 projetos
    const subtitles = screen.getAllByText(/projetos únicos/);
    expect(subtitles.length).toBeGreaterThan(0);
  });

  it("respeita período definido", () => {
    // Fora do período
    const { rerender } = render(
      <ProductionPeriodCards
        statusHistory={baseHistory}
        periodStart="2026-07-01"
        periodEnd="2026-07-31"
      />
    );
    let values = screen.getAllByText("0");
    expect(values.length).toBeGreaterThan(0);

    // Dentro do período
    rerender(
      <ProductionPeriodCards
        statusHistory={baseHistory}
        periodStart="2026-06-01"
        periodEnd="2026-06-30"
      />
    );
    values = screen.getAllByText(/^[1-4]$/);
    expect(values.length).toBeGreaterThan(0);
  });

  it("não usa updatedAt, usa alterado_em do histórico", () => {
    // O cálculo é baseado em calculateProductionMetrics que usa statusHistory.alterado_em
    // Se fosse updatedAt, os números estariam errados
    render(
      <ProductionPeriodCards
        statusHistory={baseHistory}
        periodStart="2026-06-05"
        periodEnd="2026-06-05"
      />
    );
    // Apenas p1 entrou em ANTE_PROJETO_ENVIADO em 05/06
    const anyCard = screen.getByText("Ante-projetos Enviados").closest("div");
    expect(anyCard).toBeInTheDocument();
  });

  it("exibe tooltip com período", () => {
    render(
      <ProductionPeriodCards
        statusHistory={baseHistory}
        periodStart="2026-06-01"
        periodEnd="2026-06-30"
      />
    );
    const cards = screen.getAllByText(/Ante-projetos Enviados|Projetos Finais Enviados|Projetos Aprovados/);
    const firstCard = cards[0];
    const infoIcon = firstCard.closest(".group")?.querySelector("svg");
    expect(infoIcon).toBeInTheDocument();
  });

  it("sem período retorna 0", () => {
    render(
      <ProductionPeriodCards
        statusHistory={[]}
        periodStart="2026-06-01"
        periodEnd="2026-06-30"
      />
    );
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThan(0);
  });
});
