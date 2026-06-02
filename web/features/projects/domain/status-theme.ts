/**
 * Centralized status color/theme map for the Pipeline de Projetos - TSTECK.
 *
 * Single source of truth for all status-driven visuals:
 * Kanban columns · Kanban cards · Table badges · Filters · KPIs · Alerts · Modals
 */
import type { ProjectStatus } from "@/features/projects/domain/project-types";

export type StatusTheme = {
  /** Human-readable display label (title case) */
  label: string;
  /** bg class for the colored accent strip (column top bar, card left bar) */
  accentBg: string;
  /** Column body background — very light tint */
  columnBg: string;
  /** Column border color */
  columnBorder: string;
  /** Column bg when it is the active drop target */
  columnDropBg: string;
  /** Column border when it is the active drop target */
  columnDropBorder: string;
  /** Badge pill background */
  badgeBg: string;
  /** Badge pill border */
  badgeBorder: string;
  /** Badge pill text */
  badgeText: string;
  /** Count pill inside the column header */
  countPill: string;
};

export const STATUS_THEME: Record<ProjectStatus, StatusTheme> = {
  "CADASTRO INICIAL": {
    label: "Cadastro Inicial",
    accentBg: "bg-zinc-400 dark:bg-zinc-500",
    columnBg: "bg-zinc-50 dark:bg-zinc-900/20",
    columnBorder: "border-zinc-200 dark:border-zinc-700/40",
    columnDropBg: "bg-zinc-100 dark:bg-zinc-800/30",
    columnDropBorder: "border-zinc-400 dark:border-zinc-500/60",
    badgeBg: "bg-zinc-100 dark:bg-zinc-800/60",
    badgeBorder: "border-zinc-300 dark:border-zinc-700",
    badgeText: "text-zinc-700 dark:text-zinc-300",
    countPill: "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700/40 dark:bg-zinc-800/50 dark:text-zinc-400",
  },
  "ELABORAR ANTE-PROJETO": {
    label: "Elaborar Ante-Projeto",
    accentBg: "bg-sky-400 dark:bg-sky-500",
    columnBg: "bg-sky-50/80 dark:bg-sky-950/25",
    columnBorder: "border-sky-200/80 dark:border-sky-800/30",
    columnDropBg: "bg-sky-100/80 dark:bg-sky-900/30",
    columnDropBorder: "border-sky-400 dark:border-sky-500/60",
    badgeBg: "bg-sky-50 dark:bg-sky-900/30",
    badgeBorder: "border-sky-200 dark:border-sky-700/50",
    badgeText: "text-sky-700 dark:text-sky-300",
    countPill: "border-sky-200/80 bg-sky-100/70 text-sky-700 dark:border-sky-700/40 dark:bg-sky-900/30 dark:text-sky-300",
  },
  "ANTE-PROJETO ENVIADO": {
    label: "Ante-Projeto Enviado",
    accentBg: "bg-violet-400 dark:bg-violet-500",
    columnBg: "bg-violet-50/80 dark:bg-violet-950/25",
    columnBorder: "border-violet-200/80 dark:border-violet-800/30",
    columnDropBg: "bg-violet-100/80 dark:bg-violet-900/30",
    columnDropBorder: "border-violet-400 dark:border-violet-500/60",
    badgeBg: "bg-violet-50 dark:bg-violet-900/30",
    badgeBorder: "border-violet-200 dark:border-violet-700/50",
    badgeText: "text-violet-700 dark:text-violet-300",
    countPill: "border-violet-200/80 bg-violet-100/70 text-violet-700 dark:border-violet-700/40 dark:bg-violet-900/30 dark:text-violet-300",
  },
  "ANTE-PROJETO APROVADO": {
    label: "Ante-Projeto Aprovado",
    accentBg: "bg-purple-400 dark:bg-purple-500",
    columnBg: "bg-purple-50/80 dark:bg-purple-950/25",
    columnBorder: "border-purple-200/80 dark:border-purple-800/30",
    columnDropBg: "bg-purple-100/80 dark:bg-purple-900/30",
    columnDropBorder: "border-purple-400 dark:border-purple-500/60",
    badgeBg: "bg-purple-50 dark:bg-purple-900/30",
    badgeBorder: "border-purple-200 dark:border-purple-700/50",
    badgeText: "text-purple-700 dark:text-purple-300",
    countPill: "border-purple-200/80 bg-purple-100/70 text-purple-700 dark:border-purple-700/40 dark:bg-purple-900/30 dark:text-purple-300",
  },
  "PROJETO APROVADO": {
    label: "Projeto Aprovado",
    accentBg: "bg-amber-400 dark:bg-amber-500",
    columnBg: "bg-amber-50/80 dark:bg-amber-950/25",
    columnBorder: "border-amber-200/80 dark:border-amber-800/30",
    columnDropBg: "bg-amber-100/80 dark:bg-amber-900/30",
    columnDropBorder: "border-amber-400 dark:border-amber-500/60",
    badgeBg: "bg-amber-50 dark:bg-amber-900/30",
    badgeBorder: "border-amber-200 dark:border-amber-700/50",
    badgeText: "text-amber-700 dark:text-amber-300",
    countPill: "border-amber-200/80 bg-amber-100/70 text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/30 dark:text-amber-300",
  },
  "PROJETO FINAL ENVIADO": {
    label: "Projeto Final Enviado",
    accentBg: "bg-emerald-400 dark:bg-emerald-500",
    columnBg: "bg-emerald-50/80 dark:bg-emerald-950/25",
    columnBorder: "border-emerald-200/80 dark:border-emerald-800/30",
    columnDropBg: "bg-emerald-100/80 dark:bg-emerald-900/30",
    columnDropBorder: "border-emerald-400 dark:border-emerald-500/60",
    badgeBg: "bg-emerald-50 dark:bg-emerald-900/30",
    badgeBorder: "border-emerald-200 dark:border-emerald-700/50",
    badgeText: "text-emerald-700 dark:text-emerald-300",
    countPill: "border-emerald-200/80 bg-emerald-100/70 text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  "REVISAO DE ESTUDO": {
    label: "Revisão de Estudo",
    accentBg: "bg-orange-400 dark:bg-orange-500",
    columnBg: "bg-orange-50/80 dark:bg-orange-950/25",
    columnBorder: "border-orange-200/80 dark:border-orange-800/30",
    columnDropBg: "bg-orange-100/80 dark:bg-orange-900/30",
    columnDropBorder: "border-orange-400 dark:border-orange-500/60",
    badgeBg: "bg-orange-50 dark:bg-orange-900/30",
    badgeBorder: "border-orange-200 dark:border-orange-700/50",
    badgeText: "text-orange-700 dark:text-orange-300",
    countPill: "border-orange-200/80 bg-orange-100/70 text-orange-700 dark:border-orange-700/40 dark:bg-orange-900/30 dark:text-orange-300",
  },
  "REVISAO DE PROJETO FINAL": {
    label: "Revisão de Projeto Final",
    accentBg: "bg-rose-400 dark:bg-rose-500",
    columnBg: "bg-rose-50/80 dark:bg-rose-950/25",
    columnBorder: "border-rose-200/80 dark:border-rose-800/30",
    columnDropBg: "bg-rose-100/80 dark:bg-rose-900/30",
    columnDropBorder: "border-rose-400 dark:border-rose-500/60",
    badgeBg: "bg-rose-50 dark:bg-rose-900/30",
    badgeBorder: "border-rose-200 dark:border-rose-700/50",
    badgeText: "text-rose-700 dark:text-rose-300",
    countPill: "border-rose-200/80 bg-rose-100/70 text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/30 dark:text-rose-300",
  },
};

export function getStatusTheme(status: ProjectStatus): StatusTheme {
  return STATUS_THEME[status];
}
