// Métricas de produção do período — calculadas a partir do histórico de status.
// Fonte obrigatória: ProjectStatusHistory.enteredAt (nunca updatedAt).

import type { StatusHistoryItem } from "./project-types";

export type ProductionMetrics = {
  /** Envios de ante-projeto no período (contagem de eventos). */
  anteProjetosEnviados: number;
  /** Projetos únicos que entraram em ANTE_PROJETO_ENVIADO no período. */
  anteProjetosUnicos: number;

  /** Envios de projeto final no período (contagem de eventos). */
  projetosFiaisEnviados: number;
  /** Projetos únicos que entraram em PROJETO_FINAL_ENVIADO no período. */
  projetosFiaisUnicos: number;

  /** Aprovações de projeto no período (contagem de eventos). */
  projetosAprovados: number;
  /** Projetos únicos que entraram em PROJETO_APROVADO no período. */
  projetosAprovadosUnicos: number;
};

/**
 * Calcula métricas de produção do período a partir do histórico de status.
 * Respeita apenas eventos com enteredAt dentro do período filtrado.
 *
 * @param statusHistory Histórico de status de todos os projetos (de /api/projects/analytics)
 * @param periodStart Data inicial do período (ISO yyyy-MM-dd)
 * @param periodEnd Data final do período (ISO yyyy-MM-dd)
 * @returns Métricas de produção: eventos + projetos únicos por status
 */
export function calculateProductionMetrics(
  statusHistory: StatusHistoryItem[],
  periodStart?: string | null,
  periodEnd?: string | null,
): ProductionMetrics {
  // Parse e valida datas de período
  const start = periodStart ? parseISO(periodStart) : null;
  const end = periodEnd ? parseISO(periodEnd) : null;

  // Filtra eventos dentro do período
  const eventsInPeriod = statusHistory.filter((event) => {
    const eventDate = parseISO(event.alterado_em);
    if (start && eventDate < start) return false;
    if (end && eventDate > end) return false;
    return true;
  });

  // Ante-projetos enviados
  const anteProjetosEnviados = eventsInPeriod.filter((e) => e.status_para === "ANTE-PROJETO ENVIADO");
  const anteProjetosEnviadosUnicos = new Set(anteProjetosEnviados.map((e) => e.projeto_id)).size;

  // Projetos finais enviados
  const projetosFiaisEnviados = eventsInPeriod.filter((e) => e.status_para === "PROJETO FINAL ENVIADO");
  const projetosFiaisEnviadosUnicos = new Set(projetosFiaisEnviados.map((e) => e.projeto_id)).size;

  // Projetos aprovados
  const projetosAprovadosEvents = eventsInPeriod.filter((e) => e.status_para === "PROJETO APROVADO");
  const projetosAprovadosUnicos = new Set(projetosAprovadosEvents.map((e) => e.projeto_id)).size;

  return {
    anteProjetosEnviados: anteProjetosEnviados.length,
    anteProjetosUnicos: anteProjetosEnviadosUnicos,
    projetosFiaisEnviados: projetosFiaisEnviados.length,
    projetosFiaisUnicos: projetosFiaisEnviadosUnicos,
    projetosAprovados: projetosAprovadosEvents.length,
    projetosAprovadosUnicos: projetosAprovadosUnicos,
  };
}

// ─── Utilidades ────────────────────────────────────────────────────────────

/** Normaliza string ISO para Date, permitindo apenas yyyy-MM-dd. */
function parseISO(value: string): Date {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) throw new Error(`Data inválida: ${value}`);
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}
