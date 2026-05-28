"use client";

import { useMemo, useState, type ComponentType } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  CircleDashed,
  Clock3,
  Download,
  Gauge,
  Layers,
  ListChecks,
  RefreshCcw,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { differenceInCalendarDays, format, isValid, parseISO, subDays } from "date-fns";
import { SearchableCombobox } from "./searchable-combobox";
import { PROJECT_STATUSES, type Project, type ProjectStatus, type StatusHistoryItem } from "@/features/projects/domain/project-types";
import { computeNextAction, computePrazoBadge, computePrazoEntrega, todayIsoDate } from "@/features/projects/domain/project-rules";
import { PrazoBadge, StatusBadge, UrgenteBadge } from "./pill-badges";
import { KpiCard } from "./kpi-card";

type ProjectsKpiDashboardProps = {
  projects: Project[];
  statusHistory: StatusHistoryItem[];
};

type KpiFilterState = {
  periodStart: Date | null;
  periodEnd: Date | null;
  status: "all" | ProjectStatus;
  vendedor: string;
  construtora: string;
  obra: string;
  equipamento: string;
  prioridade: "all" | "normal" | "urgente";
  situacao: "all" | "dentro_prazo" | "atrasado" | "sem_prazo";
  abertoFinalizado: "all" | "abertos" | "finalizados";
};

type CriticalProjectRow = {
  project: Project;
  diasNoStatus: number;
  motivo: string;
  acao: string;
};

type CardMetric = {
  key: string;
  label: string;
  value: string;
  tooltip: string;
  trend?: string;
  icon: ComponentType<{ size?: number; className?: string }>;
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
  "CADASTRO INICIAL": "#9ca3af",
  "ELABORAR ANTE-PROJETO": "#3b82f6",
  "ANTE-PROJETO ENVIADO": "#f59e0b",
  "ANTE-PROJETO APROVADO": "#10b981",
  "PROJETO APROVADO": "#0ea5e9",
  "PROJETO FINAL ENVIADO": "#027a48",
  "REVISAO DE ESTUDO": "#9e0b0f",
};

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function parseInputDate(value: string): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function formatDateForInput(date: Date | null): string {
  if (!date || !isValid(date)) return "";
  return format(date, "yyyy-MM-dd");
}

function safeFormatDate(date: Date | null, pattern: string, fallback = "-"): string {
  if (!date || !isValid(date)) return fallback;
  return format(date, pattern);
}

function projectStartDate(project: Project): Date {
  return parseDate(project.data_lancamento) ?? parseDate(project.created_at) ?? new Date();
}

function findFinalizedAt(project: Project, historyByProject: Map<string, StatusHistoryItem[]>): Date | null {
  const entries = historyByProject.get(project.id) ?? [];
  const hit = entries.find((item) => item.status_para === "PROJETO FINAL ENVIADO");
  if (hit) return parseDate(hit.alterado_em);
  if (project.status_atual === "PROJETO FINAL ENVIADO") {
    return parseDate(project.data_final) ?? parseDate(project.updated_at);
  }
  return null;
}

function findEnteredStatusDate(project: Project, status: ProjectStatus, historyByProject: Map<string, StatusHistoryItem[]>): Date | null {
  const entries = historyByProject.get(project.id) ?? [];
  const hit = entries.find((item) => item.status_para === status);
  if (hit) return parseDate(hit.alterado_em);
  if (project.status_atual === status) return parseDate(project.created_at) ?? parseDate(project.data_lancamento);
  return null;
}

function daysInCurrentStatus(project: Project, historyByProject: Map<string, StatusHistoryItem[]>, today: Date): number {
  const entered = findEnteredStatusDate(project, project.status_atual, historyByProject) ?? projectStartDate(project);
  return Math.max(differenceInCalendarDays(today, entered), 0);
}

function formatDelta(current: number, previous: number, suffix = ""): string {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return "";
  const delta = current - previous;
  if (Math.abs(delta) < 0.05) return `estavel vs periodo anterior`;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}${suffix} vs periodo anterior`;
}

function csvEscape(value: string): string {
  const safe = value.replace(/\"/g, '""');
  return `"${safe}"`;
}

function exportCsv(fileName: string, columns: string[], rows: string[][]) {
  const lines = [columns, ...rows].map((line) => line.map(csvEscape).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function average(numbers: number[]): number | null {
  if (!numbers.length) return null;
  const sum = numbers.reduce((acc, item) => acc + item, 0);
  return sum / numbers.length;
}

function sameMonthKey(date: Date): string {
  return format(date, "yyyy-MM");
}

function prettyMonth(key: string): string {
  return format(parseISO(`${key}-01`), "MMM/yy");
}

export function ProjectsKpiDashboard({ projects, statusHistory }: ProjectsKpiDashboardProps) {
  const [selectedStatus, setSelectedStatus] = useState<ProjectStatus | null>(null);
  const [filters, setFilters] = useState<KpiFilterState>(() => {
    return {
      periodStart: null,
      periodEnd: null,
      status: "all",
      vendedor: "",
      construtora: "",
      obra: "",
      equipamento: "",
      prioridade: "all",
      situacao: "all",
      abertoFinalizado: "all",
    };
  });

  const today = useMemo(() => parseISO(todayIsoDate()), []);

  const historyByProject = useMemo(() => {
    const map = new Map<string, StatusHistoryItem[]>();
    for (const item of statusHistory) {
      const list = map.get(item.projeto_id) ?? [];
      list.push(item);
      map.set(item.projeto_id, list);
    }
    for (const [key, list] of map.entries()) {
      map.set(key, [...list].sort((a, b) => (a.alterado_em > b.alterado_em ? 1 : -1)));
    }
    return map;
  }, [statusHistory]);

  const baseOptions = useMemo(() => {
    const construtoras = Array.from(new Set(projects.map((item) => item.construtora).filter(Boolean))).sort();
    const obras = Array.from(new Set(projects.map((item) => item.obra).filter(Boolean))).sort();
    const vendedores = Array.from(new Set(projects.map((item) => item.vendedor).filter(Boolean))).sort();
    const equipamentos = Array.from(new Set(projects.map((item) => item.equipamento).filter(Boolean))).sort();

    return {
      construtoras: construtoras.map((value) => ({ value })),
      obras: obras.map((value) => ({ value })),
      vendedores: vendedores.map((value) => ({ value })),
      equipamentos: equipamentos.map((value) => ({ value })),
    };
  }, [projects]);

  const filterCount = useMemo(() => {
    let count = 0;
    if (filters.status !== "all") count += 1;
    if (filters.vendedor) count += 1;
    if (filters.construtora) count += 1;
    if (filters.obra) count += 1;
    if (filters.equipamento) count += 1;
    if (filters.prioridade !== "all") count += 1;
    if (filters.situacao !== "all") count += 1;
    if (filters.abertoFinalizado !== "all") count += 1;
    return count;
  }, [filters]);

  const filteredProjects = useMemo(() => {
    const start = filters.periodStart;
    const end = filters.periodEnd;

    return projects.filter((project) => {
      const createdDate = projectStartDate(project);
      if (start && createdDate < start) return false;
      if (end && createdDate > end) return false;

      if (filters.status !== "all" && project.status_atual !== filters.status) return false;
      if (filters.vendedor && project.vendedor !== filters.vendedor) return false;
      if (filters.construtora && project.construtora !== filters.construtora) return false;
      if (filters.obra && project.obra !== filters.obra) return false;
      if (filters.equipamento && project.equipamento !== filters.equipamento) return false;

      if (filters.prioridade === "urgente" && !project.urgente) return false;
      if (filters.prioridade === "normal" && project.urgente) return false;

      const badge = computePrazoBadge(todayIsoDate(), computePrazoEntrega(project.data_alinhamento, project.proj_obra_recebido && project.local_cabine_definido));
      if (filters.situacao === "atrasado" && badge !== "atrasado") return false;
      if (filters.situacao === "sem_prazo" && badge !== "sem_prazo") return false;
      if (filters.situacao === "dentro_prazo" && (badge === "atrasado" || badge === "sem_prazo")) return false;

      if (filters.abertoFinalizado === "abertos" && project.status_atual === "PROJETO FINAL ENVIADO") return false;
      if (filters.abertoFinalizado === "finalizados" && project.status_atual !== "PROJETO FINAL ENVIADO") return false;

      return true;
    });
  }, [projects, filters]);

  const previousPeriodProjects = useMemo(() => {
    const start = filters.periodStart;
    const end = filters.periodEnd;
    if (!start || !end) return [] as Project[];

    const days = Math.max(differenceInCalendarDays(end, start) + 1, 1);
    const prevStart = subDays(start, days);
    const prevEnd = subDays(start, 1);

    return projects.filter((project) => {
      const createdDate = projectStartDate(project);
      if (createdDate < prevStart || createdDate > prevEnd) return false;

      if (filters.status !== "all" && project.status_atual !== filters.status) return false;
      if (filters.vendedor && project.vendedor !== filters.vendedor) return false;
      if (filters.construtora && project.construtora !== filters.construtora) return false;
      if (filters.obra && project.obra !== filters.obra) return false;
      if (filters.equipamento && project.equipamento !== filters.equipamento) return false;
      if (filters.prioridade === "urgente" && !project.urgente) return false;
      if (filters.prioridade === "normal" && project.urgente) return false;
      return true;
    });
  }, [projects, filters]);

  const analytics = useMemo(() => {
    const total = filteredProjects.length;
    const ongoing = filteredProjects.filter((item) => item.status_atual !== "PROJETO FINAL ENVIADO");
    const finalized = filteredProjects.filter((item) => item.status_atual === "PROJETO FINAL ENVIADO");
    const urgent = filteredProjects.filter((item) => item.urgente);

    const overdue = filteredProjects.filter((item) => {
      if (item.status_atual === "PROJETO FINAL ENVIADO") return false;
      return computePrazoBadge(todayIsoDate(), computePrazoEntrega(item.data_alinhamento, item.proj_obra_recebido && item.local_cabine_definido)) === "atrasado";
    });

    const withoutDeadline = filteredProjects.filter((item) => {
      const badge = computePrazoBadge(todayIsoDate(), computePrazoEntrega(item.data_alinhamento, item.proj_obra_recebido && item.local_cabine_definido));
      return item.status_atual !== "CADASTRO INICIAL" && badge === "sem_prazo";
    });

    const deliveryTimes: number[] = [];
    let estimatedByFallback = 0;

    for (const project of finalized) {
      const enteredEngineering = findEnteredStatusDate(project, "ELABORAR ANTE-PROJETO", historyByProject);
      const finalizedAt = findFinalizedAt(project, historyByProject);
      if (!finalizedAt) continue;

      const start = enteredEngineering ?? projectStartDate(project);
      if (!enteredEngineering) estimatedByFallback += 1;
      deliveryTimes.push(Math.max(differenceInCalendarDays(finalizedAt, start), 0));
    }

    const avgDelivery = average(deliveryTimes);
    const completionRate = total ? (finalized.length / total) * 100 : 0;

    const finalizedWithDeadline = finalized.filter((item) => computePrazoEntrega(item.data_alinhamento, item.proj_obra_recebido && item.local_cabine_definido));
    const finalizedInSla = finalizedWithDeadline.filter((item) => {
      const prazo = computePrazoEntrega(item.data_alinhamento, item.proj_obra_recebido && item.local_cabine_definido);
      const finalizedAt = findFinalizedAt(item, historyByProject);
      if (!prazo || !finalizedAt) return false;
      return finalizedAt <= parseISO(prazo);
    });
    const slaRate = finalizedWithDeadline.length
      ? (finalizedInSla.length / finalizedWithDeadline.length) * 100
      : 0;

    const avgAgeOpen = average(
      ongoing.map((item) => Math.max(differenceInCalendarDays(today, projectStartDate(item)), 0)),
    );

    const statusCounts = PROJECT_STATUSES.map((status) => ({
      status,
      total: filteredProjects.filter((item) => item.status_atual === status).length,
    }));

    const statusDurationBuckets = new Map<ProjectStatus, number[]>();
    for (const status of PROJECT_STATUSES) statusDurationBuckets.set(status, []);

    for (const project of filteredProjects) {
      const timeline = historyByProject.get(project.id) ?? [];
      const events = [...timeline].sort((a, b) => (a.alterado_em > b.alterado_em ? 1 : -1));

      if (!events.length) {
        statusDurationBuckets.get(project.status_atual)?.push(daysInCurrentStatus(project, historyByProject, today));
        continue;
      }

      let currentStatus = events[0].status_para;
      let enteredAt = parseDate(events[0].alterado_em) ?? projectStartDate(project);

      for (let index = 1; index < events.length; index += 1) {
        const event = events[index];
        const changedAt = parseDate(event.alterado_em);
        if (!changedAt || !enteredAt) continue;

        const duration = Math.max(differenceInCalendarDays(changedAt, enteredAt), 0);
        statusDurationBuckets.get(currentStatus)?.push(duration);

        currentStatus = event.status_para;
        enteredAt = changedAt;
      }

      if (enteredAt) {
        const duration = Math.max(differenceInCalendarDays(today, enteredAt), 0);
        statusDurationBuckets.get(currentStatus)?.push(duration);
      }
    }

    const avgByStatus = PROJECT_STATUSES.map((status) => {
      const avg = average(statusDurationBuckets.get(status) ?? []);
      return {
        status,
        dias: avg ?? 0,
        hasData: avg !== null,
      };
    });

    const monthKeys = new Set<string>();
    for (const project of filteredProjects) {
      monthKeys.add(sameMonthKey(projectStartDate(project)));
      const finalizedAt = findFinalizedAt(project, historyByProject);
      if (finalizedAt) monthKeys.add(sameMonthKey(finalizedAt));
    }

    const monthly = Array.from(monthKeys)
      .sort()
      .slice(-8)
      .map((key) => {
        const created = filteredProjects.filter((item) => sameMonthKey(projectStartDate(item)) === key).length;
        const done = filteredProjects.filter((item) => {
          const finalizedAt = findFinalizedAt(item, historyByProject);
          return finalizedAt ? sameMonthKey(finalizedAt) === key : false;
        }).length;
        return {
          mes: prettyMonth(key),
          criados: created,
          finalizados: done,
        };
      });

    const bySeller = Array.from(
      filteredProjects.reduce((acc, project) => {
        acc.set(project.vendedor, (acc.get(project.vendedor) ?? 0) + 1);
        return acc;
      }, new Map<string, number>()),
    )
      .map(([nome, totalProjetos]) => ({ nome, totalProjetos }))
      .sort((a, b) => b.totalProjetos - a.totalProjetos)
      .slice(0, 10);

    const byConstrutora = Array.from(
      filteredProjects.reduce((acc, project) => {
        acc.set(project.construtora, (acc.get(project.construtora) ?? 0) + 1);
        return acc;
      }, new Map<string, number>()),
    )
      .map(([nome, totalProjetos]) => ({ nome, totalProjetos }))
      .sort((a, b) => b.totalProjetos - a.totalProjetos)
      .slice(0, 10);

    const priority = [
      { nome: "Urgente", total: urgent.length, color: "#9e0b0f" },
      { nome: "Normal", total: total - urgent.length, color: "#9ca3af" },
    ];

    const deadlineSituation = [
      {
        nome: "Dentro do prazo",
        total: filteredProjects.filter((item) => {
          const badge = computePrazoBadge(todayIsoDate(), computePrazoEntrega(item.data_alinhamento, item.proj_obra_recebido && item.local_cabine_definido));
          return badge === "no_prazo";
        }).length,
        color: "#027a48",
      },
      {
        nome: "Proximo do prazo",
        total: filteredProjects.filter((item) => {
          const badge = computePrazoBadge(todayIsoDate(), computePrazoEntrega(item.data_alinhamento, item.proj_obra_recebido && item.local_cabine_definido));
          return badge === "atencao";
        }).length,
        color: "#b54708",
      },
      {
        nome: "Atrasado",
        total: overdue.length,
        color: "#9e0b0f",
      },
      {
        nome: "Sem prazo",
        total: filteredProjects.filter((item) => computePrazoBadge(todayIsoDate(), computePrazoEntrega(item.data_alinhamento, item.proj_obra_recebido && item.local_cabine_definido)) === "sem_prazo").length,
        color: "#6b7280",
      },
    ];

    const funnel = [
      "CADASTRO INICIAL",
      "ELABORAR ANTE-PROJETO",
      "ANTE-PROJETO ENVIADO",
      "ANTE-PROJETO APROVADO",
      "PROJETO FINAL ENVIADO",
    ].map((status) => ({
      etapa: status,
      total: filteredProjects.filter((item) => item.status_atual === status).length,
    }));

    const mostBottleneck = [...avgByStatus]
      .filter((item) => item.hasData)
      .sort((a, b) => b.dias - a.dias)[0];

    const mostStacked = [...statusCounts].sort((a, b) => b.total - a.total)[0];

    const stalledProjects = filteredProjects.filter((project) => daysInCurrentStatus(project, historyByProject, today) >= 10);

    const urgentStalled = urgent.filter((project) => {
      const updated = parseDate(project.updated_at) ?? today;
      return differenceInCalendarDays(today, updated) >= 7;
    });

    const criticalRows: CriticalProjectRow[] = [];
    for (const project of filteredProjects) {
      const badge = computePrazoBadge(todayIsoDate(), computePrazoEntrega(project.data_alinhamento, project.proj_obra_recebido && project.local_cabine_definido));
      const diasStatus = daysInCurrentStatus(project, historyByProject, today);

      if (badge === "atrasado") {
        criticalRows.push({
          project,
          diasNoStatus: diasStatus,
          motivo: `Atrasado ha ${Math.abs(differenceInCalendarDays(today, parseISO(computePrazoEntrega(project.data_alinhamento, project.proj_obra_recebido && project.local_cabine_definido) ?? todayIsoDate())))} dias`,
          acao: "Priorizar tratativa com time tecnico e cliente.",
        });
      }

      if (project.urgente) {
        criticalRows.push({
          project,
          diasNoStatus: diasStatus,
          motivo: "Urgente",
          acao: "Acompanhar diariamente ate regularizacao.",
        });
      }

      if (project.status_atual !== "CADASTRO INICIAL" && badge === "sem_prazo") {
        criticalRows.push({
          project,
          diasNoStatus: diasStatus,
          motivo: "Sem prazo definido",
          acao: "Definir prazo e responsavel ainda nesta semana.",
        });
      }

      if (diasStatus >= 12) {
        criticalRows.push({
          project,
          diasNoStatus: diasStatus,
          motivo: `Parado ha ${diasStatus} dias`,
          acao: "Escalar bloqueio e definir plano de destravamento.",
        });
      }

      if (project.status_atual === "REVISAO DE ESTUDO") {
        criticalRows.push({
          project,
          diasNoStatus: diasStatus,
          motivo: "Em revisao de estudo",
          acao: "Concluir revisao tecnica e validar pendencias.",
        });
      }

      if (badge === "atencao") {
        criticalRows.push({
          project,
          diasNoStatus: diasStatus,
          motivo: "Proximo do vencimento",
          acao: "Executar plano de aceleracao para evitar atraso.",
        });
      }
    }

    const dedupCritical = Array.from(
      criticalRows.reduce((acc, item) => {
        const key = `${item.project.id}-${item.motivo}`;
        acc.set(key, item);
        return acc;
      }, new Map<string, CriticalProjectRow>()),
    )
      .map(([, item]) => item)
      .sort((a, b) => {
        if (a.project.urgente !== b.project.urgente) return a.project.urgente ? -1 : 1;
        return b.diasNoStatus - a.diasNoStatus;
      })
      .slice(0, 25);

    const insights: string[] = [];
    if (mostStacked && ongoing.length) {
      const pct = ((mostStacked.total / Math.max(ongoing.length, 1)) * 100).toFixed(1);
      insights.push(`O status ${mostStacked.status} concentra ${pct}% dos projetos em andamento.`);
    }
    if (total) insights.push(`Projetos urgentes representam ${((urgent.length / total) * 100).toFixed(1)}% da carteira atual.`);
    if (avgDelivery !== null) insights.push(`Tempo medio de entrega atual em ${avgDelivery.toFixed(1)} dias.`);
    if (withoutDeadline.length) insights.push(`Existem ${withoutDeadline.length} projetos sem prazo definido fora do cadastro inicial.`);
    if (bySeller[0]) insights.push(`O vendedor ${bySeller[0].nome} possui o maior volume de projetos (${bySeller[0].totalProjetos}).`);
    if (byConstrutora[0]) insights.push(`A construtora ${byConstrutora[0].nome} concentra o maior volume de projetos (${byConstrutora[0].totalProjetos}).`);

    return {
      total,
      ongoing,
      finalized,
      urgent,
      overdue,
      withoutDeadline,
      avgDelivery,
      completionRate,
      slaRate,
      avgAgeOpen,
      estimatedByFallback,
      statusCounts,
      avgByStatus,
      monthly,
      bySeller,
      byConstrutora,
      priority,
      deadlineSituation,
      funnel,
      bottleneck: mostBottleneck,
      stacked: mostStacked,
      stalledProjects,
      urgentStalled,
      criticalRows: dedupCritical,
      insights,
    };
  }, [filteredProjects, historyByProject, today]);

  const previousMetrics = useMemo(() => {
    const total = previousPeriodProjects.length;
    const finalized = previousPeriodProjects.filter((item) => item.status_atual === "PROJETO FINAL ENVIADO").length;
    const overdue = previousPeriodProjects.filter((item) => {
      if (item.status_atual === "PROJETO FINAL ENVIADO") return false;
      return computePrazoBadge(todayIsoDate(), computePrazoEntrega(item.data_alinhamento, item.proj_obra_recebido && item.local_cabine_definido)) === "atrasado";
    }).length;
    const urgent = previousPeriodProjects.filter((item) => item.urgente).length;

    return { total, finalized, overdue, urgent };
  }, [previousPeriodProjects]);

  const cards = useMemo<CardMetric[]>(() => {
    const avgDeliveryLabel = analytics.avgDelivery === null ? "N/D" : `${analytics.avgDelivery.toFixed(1)} dias`;
    const avgAgeOpenLabel = analytics.avgAgeOpen === null ? "N/D" : `${analytics.avgAgeOpen.toFixed(1)} dias`;

    return [
      {
        key: "total",
        label: "Total de Projetos",
        value: String(analytics.total),
        tooltip: "Quantidade total de projetos no periodo filtrado.",
        trend: formatDelta(analytics.total, previousMetrics.total),
        icon: Layers,
      },
      {
        key: "andamento",
        label: "Projetos em Andamento",
        value: String(analytics.ongoing.length),
        tooltip: "Projetos que ainda nao chegaram em Projeto Final Enviado.",
        icon: CircleDashed,
      },
      {
        key: "finalizados",
        label: "Projetos Finalizados",
        value: String(analytics.finalized.length),
        tooltip: "Projetos com status Projeto Final Enviado.",
        trend: formatDelta(analytics.finalized.length, previousMetrics.finalized),
        icon: CheckCircle2,
      },
      {
        key: "urgentes",
        label: "Projetos Urgentes",
        value: String(analytics.urgent.length),
        tooltip: "Projetos marcados com prioridade urgente.",
        trend: formatDelta(analytics.urgent.length, previousMetrics.urgent),
        icon: AlertTriangle,
      },
      {
        key: "atrasados",
        label: "Projetos Atrasados",
        value: String(analytics.overdue.length),
        tooltip: "Projetos com prazo vencido e nao finalizados.",
        trend: formatDelta(analytics.overdue.length, previousMetrics.overdue),
        icon: Clock3,
      },
      {
        key: "semPrazo",
        label: "Projetos sem Prazo",
        value: String(analytics.withoutDeadline.length),
        tooltip: "Projetos fora do cadastro inicial sem prazo definido.",
        icon: CalendarRange,
      },
      {
        key: "tempoMedioEntrega",
        label: "Tempo Medio de Entrega",
        value: avgDeliveryLabel,
        tooltip: "Media de dias entre Elaborar Ante-Projeto e Projeto Final Enviado.",
        icon: Gauge,
      },
      {
        key: "taxaConclusao",
        label: "Taxa de Conclusao",
        value: `${analytics.completionRate.toFixed(1)}%`,
        tooltip: "Percentual de projetos finalizados sobre o total do periodo.",
        icon: TrendingUp,
      },
      {
        key: "sla",
        label: "SLA no Prazo",
        value: `${analytics.slaRate.toFixed(1)}%`,
        tooltip: "Percentual de finalizados dentro do prazo.",
        icon: CheckCircle2,
      },
      {
        key: "idadeMedia",
        label: "Idade Media (Abertos)",
        value: avgAgeOpenLabel,
        tooltip: "Media de idade dos projetos em andamento.",
        icon: Clock3,
      },
    ];
  }, [analytics, previousMetrics]);

  const drilldownProjects = useMemo(() => {
    if (!selectedStatus) return [];
    return filteredProjects.filter((item) => item.status_atual === selectedStatus);
  }, [filteredProjects, selectedStatus]);

  const drilldownStats = useMemo(() => {
    if (!selectedStatus) return null;
    const projectsInStatus = drilldownProjects;
    const avgDays = average(projectsInStatus.map((item) => daysInCurrentStatus(item, historyByProject, today)));
    const urgentCount = projectsInStatus.filter((item) => item.urgente).length;
    const noDeadline = projectsInStatus.filter((item) => computePrazoBadge(todayIsoDate(), computePrazoEntrega(item.data_alinhamento, item.proj_obra_recebido && item.local_cabine_definido)) === "sem_prazo").length;

    return {
      total: projectsInStatus.length,
      avgDays,
      urgentCount,
      noDeadline,
      oldest: [...projectsInStatus]
        .sort((a, b) => daysInCurrentStatus(b, historyByProject, today) - daysInCurrentStatus(a, historyByProject, today))
        .slice(0, 5),
    };
  }, [selectedStatus, drilldownProjects, historyByProject, today]);

  function clearFilters() {
    setFilters({
      periodStart: null,
      periodEnd: null,
      status: "all",
      vendedor: "",
      construtora: "",
      obra: "",
      equipamento: "",
      prioridade: "all",
      situacao: "all",
      abertoFinalizado: "all",
    });
  }

  function exportReport() {
    const rows = filteredProjects.map((project) => [
      project.codigo_projeto,
      project.construtora,
      project.obra,
      project.vendedor,
      project.equipamento,
      project.status_atual,
      project.urgente ? "Urgente" : "Normal",
      computePrazoEntrega(project.data_alinhamento, project.proj_obra_recebido && project.local_cabine_definido) ?? "",
      String(daysInCurrentStatus(project, historyByProject, today)),
      computeNextAction(project),
    ]);

    exportCsv(
      `kpi-relatorio-projetos-${todayIsoDate()}.csv`,
      [
        "Codigo",
        "Construtora",
        "Obra",
        "Vendedor",
        "Equipamento",
        "Status",
        "Prioridade",
        "Prazo",
        "Dias no status",
        "Proxima acao",
      ],
      rows,
    );
  }

  const periodStartLabel = safeFormatDate(filters.periodStart, "dd/MM/yyyy", "");
  const periodEndLabel = safeFormatDate(filters.periodEnd, "dd/MM/yyyy", "");
  const periodLabel = periodStartLabel && periodEndLabel ? `${periodStartLabel} a ${periodEndLabel}` : "Todos os periodos";

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-line bg-white p-5 shadow-[0_16px_30px_-24px_rgba(0,0,0,0.4)]">
        <div className="flex flex-wrap items-start gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-zinc-900">Dashboard de Projetos</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Acompanhamento de produtividade, prazos, status, urgencias e desempenho do fluxo de projetos.
            </p>
          </div>
          <div className="ml-auto grid gap-1 text-xs text-zinc-600">
            <p className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 font-semibold">
              <RefreshCcw size={12} /> Ultima atualizacao: {new Date().toLocaleString()}
            </p>
            <p className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 font-semibold">
              <CalendarRange size={12} /> Periodo analisado: {periodLabel}
            </p>
            <p className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 font-semibold">
              <BarChart3 size={12} /> Projetos considerados: {filteredProjects.length}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-line bg-white p-5 shadow-[0_16px_30px_-24px_rgba(0,0,0,0.4)]">
        <header className="mb-4 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-zinc-900">Filtros analiticos</h3>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{filterCount} filtros aplicados</span>
          <button type="button" onClick={clearFilters} className="ml-auto rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-900">
            Limpar filtros
          </button>
          <button type="button" onClick={exportReport} className="inline-flex items-center gap-1 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand">
            <Download size={13} /> Exportar relatorio
          </button>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="rounded-2xl border border-line bg-zinc-50 p-3 text-xs">
            <span className="mb-1 block font-semibold text-zinc-700">Periodo inicial</span>
            <div className="space-y-1">
              <input
                type="date"
                value={formatDateForInput(filters.periodStart)}
                onChange={(event) => setFilters((prev) => ({ ...prev, periodStart: parseInputDate(event.target.value) }))}
                className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
              <div className="flex gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, periodStart: new Date() }))}
                  className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-900"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, periodStart: null }))}
                  className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-900"
                >
                  Limpar data
                </button>
              </div>
            </div>
          </label>

          <label className="rounded-2xl border border-line bg-zinc-50 p-3 text-xs">
            <span className="mb-1 block font-semibold text-zinc-700">Periodo final</span>
            <div className="space-y-1">
              <input
                type="date"
                value={formatDateForInput(filters.periodEnd)}
                onChange={(event) => setFilters((prev) => ({ ...prev, periodEnd: parseInputDate(event.target.value) }))}
                className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
              <div className="flex gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, periodEnd: new Date() }))}
                  className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-900"
                >
                  Hoje
                </button>
                <button
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, periodEnd: null }))}
                  className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-900"
                >
                  Limpar data
                </button>
              </div>
            </div>
          </label>

          <label className="rounded-2xl border border-line bg-zinc-50 p-3 text-xs">
            <span className="mb-1 block font-semibold text-zinc-700">Status</span>
            <SearchableCombobox
              value={filters.status}
              options={[{ value: "all", label: "Todos status" }, ...PROJECT_STATUSES.map((status) => ({ value: status, label: status }))]}
              onChange={(value) => setFilters((prev) => ({ ...prev, status: value as KpiFilterState["status"] }))}
              placeholder="Status"
              searchPlaceholder="Buscar status..."
              emptyMessage="Nenhum status encontrado."
              ariaLabel="Filtrar por status KPI"
            />
          </label>

          <label className="rounded-2xl border border-line bg-zinc-50 p-3 text-xs">
            <span className="mb-1 block font-semibold text-zinc-700">Vendedor</span>
            <SearchableCombobox
              value={filters.vendedor}
              options={baseOptions.vendedores}
              onChange={(value) => setFilters((prev) => ({ ...prev, vendedor: value }))}
              placeholder="Vendedor"
              searchPlaceholder="Buscar vendedor..."
              emptyMessage="Nenhum vendedor encontrado."
              ariaLabel="Filtrar KPI por vendedor"
            />
          </label>

          <label className="rounded-2xl border border-line bg-zinc-50 p-3 text-xs">
            <span className="mb-1 block font-semibold text-zinc-700">Construtora</span>
            <SearchableCombobox
              value={filters.construtora}
              options={baseOptions.construtoras}
              onChange={(value) => setFilters((prev) => ({ ...prev, construtora: value }))}
              placeholder="Construtora"
              searchPlaceholder="Buscar construtora..."
              emptyMessage="Nenhuma construtora encontrada."
              ariaLabel="Filtrar KPI por construtora"
            />
          </label>

          <label className="rounded-2xl border border-line bg-zinc-50 p-3 text-xs">
            <span className="mb-1 block font-semibold text-zinc-700">Obra</span>
            <SearchableCombobox
              value={filters.obra}
              options={baseOptions.obras}
              onChange={(value) => setFilters((prev) => ({ ...prev, obra: value }))}
              placeholder="Obra"
              searchPlaceholder="Buscar obra..."
              emptyMessage="Nenhuma obra encontrada."
              ariaLabel="Filtrar KPI por obra"
            />
          </label>

          <label className="rounded-2xl border border-line bg-zinc-50 p-3 text-xs">
            <span className="mb-1 block font-semibold text-zinc-700">Equipamento</span>
            <SearchableCombobox
              value={filters.equipamento}
              options={baseOptions.equipamentos}
              onChange={(value) => setFilters((prev) => ({ ...prev, equipamento: value }))}
              placeholder="Equipamento"
              searchPlaceholder="Buscar equipamento..."
              emptyMessage="Nenhum equipamento encontrado."
              ariaLabel="Filtrar KPI por equipamento"
            />
          </label>

          <label className="rounded-2xl border border-line bg-zinc-50 p-3 text-xs">
            <span className="mb-1 block font-semibold text-zinc-700">Prioridade</span>
            <select value={filters.prioridade} onChange={(event) => setFilters((prev) => ({ ...prev, prioridade: event.target.value as KpiFilterState["prioridade"] }))} className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15">
              <option value="all">Todos</option>
              <option value="normal">Normal</option>
              <option value="urgente">Urgente</option>
            </select>
          </label>

          <label className="rounded-2xl border border-line bg-zinc-50 p-3 text-xs">
            <span className="mb-1 block font-semibold text-zinc-700">Situacao</span>
            <select value={filters.situacao} onChange={(event) => setFilters((prev) => ({ ...prev, situacao: event.target.value as KpiFilterState["situacao"] }))} className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15">
              <option value="all">Todos</option>
              <option value="dentro_prazo">Dentro do prazo</option>
              <option value="atrasado">Atrasado</option>
              <option value="sem_prazo">Sem prazo</option>
            </select>
          </label>

          <label className="rounded-2xl border border-line bg-zinc-50 p-3 text-xs">
            <span className="mb-1 block font-semibold text-zinc-700">Finalizados / Abertos</span>
            <select value={filters.abertoFinalizado} onChange={(event) => setFilters((prev) => ({ ...prev, abertoFinalizado: event.target.value as KpiFilterState["abertoFinalizado"] }))} className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15">
              <option value="all">Todos</option>
              <option value="abertos">Em aberto</option>
              <option value="finalizados">Finalizados</option>
            </select>
          </label>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
        {cards.map((card) => {
          return (
            <KpiCard
              key={card.key}
              title={card.label}
              value={card.value}
              description={card.tooltip}
              icon={card.icon}
              trend={card.trend}
              tooltip={card.tooltip}
              variant={
                card.key === "atrasados"
                  ? "danger"
                  : card.key === "urgentes"
                    ? "brand"
                    : card.key === "finalizados" || card.key === "sla"
                      ? "success"
                      : card.key === "tempoMedioEntrega" || card.key === "idadeMedia"
                        ? "info"
                        : "neutral"
              }
            />
          );
        })}
      </section>

      {analytics.estimatedByFallback > 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
          Calculo estimado por ausencia de historico completo ({analytics.estimatedByFallback} projeto(s)).
        </p>
      )}

      <section className="grid gap-3 xl:grid-cols-2">
        <article className="rounded-2xl border border-line bg-white p-3">
          <h3 className="mb-2 text-sm font-bold text-zinc-900">Projetos por Status</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.statusCounts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="status" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="total"
                  onClick={(entry) => {
                    const payload = (entry as { payload?: { status?: ProjectStatus } } | undefined)?.payload;
                    setSelectedStatus(payload?.status ?? null);
                  }}
                >
                  {analytics.statusCounts.map((item) => (
                    <Cell key={item.status} fill={STATUS_COLORS[item.status]} cursor="pointer" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-line bg-white p-3">
          <h3 className="mb-2 text-sm font-bold text-zinc-900">Tempo Medio por Status (dias)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.avgByStatus} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="status" width={150} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="dias" fill="#262626" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-line bg-white p-3">
          <h3 className="mb-2 text-sm font-bold text-zinc-900">Evolucao Mensal (Criados vs Finalizados)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="criados" name="Criados" stroke="#262626" fill="#d4d4d8" />
                <Area type="monotone" dataKey="finalizados" name="Finalizados" stroke="#9e0b0f" fill="#fecaca" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-line bg-white p-3">
          <h3 className="mb-2 text-sm font-bold text-zinc-900">Projetos por Vendedor</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.bySeller} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="nome" type="category" width={100} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="totalProjetos" fill="#262626" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-line bg-white p-3">
          <h3 className="mb-2 text-sm font-bold text-zinc-900">Projetos por Construtora</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.byConstrutora} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="nome" type="category" width={120} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="totalProjetos" fill="#9e0b0f" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-line bg-white p-3">
          <h3 className="mb-2 text-sm font-bold text-zinc-900">Distribuicao de Prioridade</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={analytics.priority} dataKey="total" nameKey="nome" outerRadius={96} label>
                  {analytics.priority.map((entry) => (
                    <Cell key={entry.nome} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-line bg-white p-3">
          <h3 className="mb-2 text-sm font-bold text-zinc-900">Situacao de Prazo</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={analytics.deadlineSituation} dataKey="total" nameKey="nome" innerRadius={40} outerRadius={96} label>
                  {analytics.deadlineSituation.map((entry) => (
                    <Cell key={entry.nome} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-line bg-white p-3">
          <h3 className="mb-2 text-sm font-bold text-zinc-900">Funil do Fluxo de Projetos</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.funnel}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="etapa" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="#262626" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <article className="rounded-2xl border border-line bg-white p-3">
          <h3 className="mb-2 text-sm font-bold text-zinc-900">Gargalos do Fluxo</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs font-semibold text-zinc-500 uppercase">Maior gargalo</p>
              <p className="mt-1 text-sm font-bold text-zinc-900">{analytics.bottleneck?.status ?? "N/D"}</p>
              <p className="text-xs text-zinc-600">Tempo medio: {analytics.bottleneck ? `${analytics.bottleneck.dias.toFixed(1)} dias` : "N/D"}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs font-semibold text-zinc-500 uppercase">Status com maior acumulacao</p>
              <p className="mt-1 text-sm font-bold text-zinc-900">{analytics.stacked?.status ?? "N/D"}</p>
              <p className="text-xs text-zinc-600">Projetos: {analytics.stacked?.total ?? "N/D"}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs font-semibold text-zinc-500 uppercase">Projetos parados</p>
              <p className="mt-1 text-sm font-bold text-zinc-900">{analytics.stalledProjects.length}</p>
              <p className="text-xs text-zinc-600">Parados ha 10+ dias no status atual.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs font-semibold text-zinc-500 uppercase">Urgentes sem avancar</p>
              <p className="mt-1 text-sm font-bold text-zinc-900">{analytics.urgentStalled.length}</p>
              <p className="text-xs text-zinc-600">Atualizacao ausente ha 7+ dias.</p>
            </div>
          </div>
          <p className="mt-2 rounded-lg border border-brand/20 bg-brand/5 px-2 py-1 text-xs font-medium text-zinc-700">
            Acao recomendada: revisar pendencias no status mais acumulado e priorizar projetos urgentes sem atualizacao.
          </p>
        </article>

        <article className="rounded-2xl border border-line bg-white p-3">
          <h3 className="mb-2 text-sm font-bold text-zinc-900">Insights do periodo</h3>
          <div className="space-y-2">
            {analytics.insights.map((insight, index) => (
              <p key={index} className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">{insight}</p>
            ))}
            {!analytics.insights.length && (
              <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-4 text-sm text-zinc-500">
                Nao ha dados suficientes para gerar insights neste periodo.
              </p>
            )}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-line bg-white p-3">
        <header className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-zinc-900">Projetos que exigem atencao</h3>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">{analytics.criticalRows.length} itens</span>
        </header>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100/80 text-xs tracking-wide text-zinc-600 uppercase">
              <tr>
                <th className="px-2 py-2 text-left">Codigo</th>
                <th className="px-2 py-2 text-left">Construtora / Obra</th>
                <th className="px-2 py-2 text-left">Vendedor</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2 text-left">Prazo</th>
                <th className="px-2 py-2 text-left">Dias no status</th>
                <th className="px-2 py-2 text-left">Prioridade</th>
                <th className="px-2 py-2 text-left">Motivo do alerta</th>
                <th className="px-2 py-2 text-left">Acao recomendada</th>
              </tr>
            </thead>
            <tbody>
              {analytics.criticalRows.map((row, index) => (
                <tr key={`${row.project.id}-${index}`} className="border-t border-zinc-100 align-top">
                  <td className="px-2 py-2 font-mono text-xs font-semibold text-zinc-900">{row.project.codigo_projeto}</td>
                  <td className="px-2 py-2 text-xs text-zinc-700">{row.project.construtora} - {row.project.obra}</td>
                  <td className="px-2 py-2 text-xs text-zinc-700">{row.project.vendedor}</td>
                  <td className="px-2 py-2"><StatusBadge status={row.project.status_atual} /></td>
                  <td className="px-2 py-2"><PrazoBadge project={row.project} /></td>
                  <td className="px-2 py-2 text-xs font-semibold text-zinc-800">{row.diasNoStatus}</td>
                  <td className="px-2 py-2"><UrgenteBadge urgente={row.project.urgente} /></td>
                  <td className="px-2 py-2 text-xs text-zinc-700">{row.motivo}</td>
                  <td className="px-2 py-2 text-xs text-zinc-700">{row.acao}</td>
                </tr>
              ))}
              {!analytics.criticalRows.length && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-sm text-zinc-500">Nenhum projeto critico com os filtros atuais.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedStatus && drilldownStats && (
        <div className="fixed inset-0 z-[96] bg-black/45" onMouseDown={(event) => event.target === event.currentTarget && setSelectedStatus(null)}>
          <aside className="ml-auto h-full w-full max-w-[680px] overflow-y-auto border-l border-line bg-white p-4 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <header className="mb-3 flex items-center gap-2 border-b border-zinc-200 pb-2">
              <ListChecks size={16} className="text-zinc-600" />
              <h3 className="text-base font-bold text-zinc-900">Drill-down por status: {selectedStatus}</h3>
              <button type="button" onClick={() => setSelectedStatus(null)} className="ml-auto rounded-lg border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700">Fechar</button>
            </header>

            <div className="grid gap-2 sm:grid-cols-2">
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs"><span className="font-semibold">Total:</span> {drilldownStats.total}</p>
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs"><span className="font-semibold">Tempo medio:</span> {drilldownStats.avgDays !== null ? `${drilldownStats.avgDays.toFixed(1)} dias` : "N/D"}</p>
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs"><span className="font-semibold">Urgentes:</span> {drilldownStats.urgentCount}</p>
              <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-2 text-xs"><span className="font-semibold">Sem prazo:</span> {drilldownStats.noDeadline}</p>
            </div>

            <h4 className="mt-3 mb-1 text-sm font-bold text-zinc-900">Projetos deste status</h4>
            <div className="space-y-2">
              {drilldownProjects.map((project) => (
                <article key={project.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-zinc-900">{project.codigo_projeto}</span>
                    <UrgenteBadge urgente={project.urgente} />
                    <StatusBadge status={project.status_atual} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-700">{project.construtora} - {project.obra}</p>
                  <p className="text-xs text-zinc-600">Dias no status: {daysInCurrentStatus(project, historyByProject, today)}</p>
                  <p className="mt-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600">Proxima acao: {computeNextAction(project)}</p>
                </article>
              ))}
            </div>

            {drilldownStats.oldest.length > 0 && (
              <>
                <h4 className="mt-3 mb-1 text-sm font-bold text-zinc-900">Projetos mais antigos no status</h4>
                <ul className="space-y-1">
                  {drilldownStats.oldest.map((project) => (
                    <li key={project.id} className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700">
                      {project.codigo_projeto} - {daysInCurrentStatus(project, historyByProject, today)} dias
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
