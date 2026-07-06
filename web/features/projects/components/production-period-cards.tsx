"use client";

import { Package, CheckCircle2, Send } from "lucide-react";
import { useMemo } from "react";
import { calculateProductionMetrics } from "@/features/projects/domain/production-metrics";
import { KpiCard } from "./kpi-card";
import type { StatusHistoryItem } from "@/features/projects/domain/project-types";

type ProductionPeriodCardsProps = {
  statusHistory: StatusHistoryItem[];
  periodStart?: string | null;
  periodEnd?: string | null;
};

export function ProductionPeriodCards({
  statusHistory,
  periodStart,
  periodEnd,
}: ProductionPeriodCardsProps) {
  const metrics = useMemo(
    () => calculateProductionMetrics(statusHistory, periodStart, periodEnd),
    [statusHistory, periodStart, periodEnd]
  );

  const periodLabel = periodStart && periodEnd ? `${periodStart} a ${periodEnd}` : "Todos os períodos";

  const cards = [
    {
      key: "ante-projetos-enviados",
      title: "Ante-projetos Enviados",
      value: String(metrics.anteProjetosEnviados),
      tooltip: `${metrics.anteProjetosEnviados} envios no período · ${metrics.anteProjetosUnicos} únicos · ${periodLabel}`,
      subtitle: `${metrics.anteProjetosUnicos} projetos únicos`,
      icon: Send,
    },
    {
      key: "projetos-finais-enviados",
      title: "Projetos Finais Enviados",
      value: String(metrics.projetosFiaisEnviados),
      tooltip: `${metrics.projetosFiaisEnviados} envios no período · ${metrics.projetosFiaisUnicos} únicos · ${periodLabel}`,
      subtitle: `${metrics.projetosFiaisUnicos} projetos únicos`,
      icon: Package,
    },
    {
      key: "projetos-aprovados",
      title: "Projetos Aprovados",
      value: String(metrics.projetosAprovados),
      tooltip: `${metrics.projetosAprovados} aprovações no período · ${metrics.projetosAprovadosUnicos} únicos · ${periodLabel}`,
      subtitle: `${metrics.projetosAprovadosUnicos} projetos únicos`,
      icon: CheckCircle2,
    },
  ];

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Produção do Período</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <div key={card.key} className="group">
            <KpiCard
              title={card.title}
              value={card.value}
              icon={card.icon}
              tooltip={card.tooltip}
              variant="success"
            />
            <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-500">
              {card.subtitle}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
