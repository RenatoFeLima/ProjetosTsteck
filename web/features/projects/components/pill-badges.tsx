import { getStatusTheme } from "@/features/projects/domain/status-theme";
import { getCurrentStatusDeadline, shouldShowOperationalDeadline } from "@/features/projects/domain/project-rules";
import type { Project, ProjectStatus } from "@/features/projects/domain/project-types";
import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";

const BASE_BADGE_CLASS =
  "inline-flex h-7 max-w-full items-center whitespace-nowrap overflow-hidden text-ellipsis rounded-full border px-2.5 text-[11px] font-semibold tracking-wide";

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const { badgeBg, badgeBorder, badgeText, label } = getStatusTheme(status);
  return (
    <span title={status} className={`${BASE_BADGE_CLASS} max-w-[180px] ${badgeBg} ${badgeBorder} ${badgeText}`}>
      <span className="truncate">{label}</span>
    </span>
  );
}

export function UrgenteBadge({ urgente, urgentDeadline }: { urgente: boolean; urgentDeadline?: string | null }) {
  if (!urgente) return null;

  let label = "Urgente";
  let tooltip = "Prioridade urgente";

  if (urgentDeadline) {
    const due = parseISO(urgentDeadline.slice(0, 10));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = differenceInCalendarDays(due, today);
    if (diff < 0) {
      label = `Urgente · ${Math.abs(diff)}d atrasado`;
      tooltip = `Prazo vencido há ${Math.abs(diff)} dia(s): ${urgentDeadline.slice(0, 10)}`;
    } else if (diff === 0) {
      label = "Urgente · vence hoje";
      tooltip = `Prazo de urgência vence hoje: ${urgentDeadline.slice(0, 10)}`;
    } else {
      label = `Urgente · ${diff}d restantes`;
      tooltip = `Prazo de urgência: ${urgentDeadline.slice(0, 10)} (${diff} dia(s) restantes)`;
    }
  }

  const isOverdue = urgentDeadline
    ? differenceInCalendarDays(parseISO(urgentDeadline.slice(0, 10)), new Date()) < 0
    : false;

  return (
    <span
      title={tooltip}
      className={`${BASE_BADGE_CLASS} gap-1 ${
        isOverdue
          ? "border-red-400 bg-red-100 text-red-800 dark:border-red-600 dark:bg-red-900/40 dark:text-red-200"
          : "border-red-200 bg-red-50 text-[#9e0b0f] dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300"
      }`}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      <span className="truncate">{label}</span>
    </span>
  );
}

function formatDateLabel(isoDate: string | null): string {
  if (!isoDate) return "";
  const parsed = parseISO(isoDate);
  if (!isValid(parsed)) return "";
  return format(parsed, "dd/MM/yyyy");
}

// Keep for future use
void formatDateLabel;

export function DeadlineBadge({ project }: { project: Project }) {
  // Prazo operacional só aparece nos status com SLA ativo e quando o projeto
  // não é urgente (urgência tem prioridade visual via UrgenteBadge). Fora disso
  // não renderiza nada — evita "Sem prazo"/"0 dias" em etapas sem SLA.
  if (!shouldShowOperationalDeadline(project)) return null;

  const deadline = getCurrentStatusDeadline(project);
  const { label, isOverdue, daysRemaining, hasDeadline, dueDate } = deadline;

  const tooltip = hasDeadline && dueDate
    ? isOverdue
      ? `Prazo esgotado em ${dueDate}`
      : `Prazo até ${dueDate} (${daysRemaining}d restantes)`
    : "Sem prazo de entrega nesta etapa";

  const className = isOverdue
    ? "border-red-300 bg-red-100 text-red-700 dark:border-red-700/50 dark:bg-red-900/30 dark:text-red-300"
    : hasDeadline && (daysRemaining ?? 999) <= 7
      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-700/50 dark:bg-rose-900/30 dark:text-rose-300"
      : hasDeadline && (daysRemaining ?? 999) <= 15
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-300"
        : hasDeadline
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/30 dark:text-emerald-300"
          : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700/50 dark:bg-zinc-800/40 dark:text-zinc-400";

  return (
    <span title={tooltip} className={`${BASE_BADGE_CLASS} max-w-[120px] ${className}`}>
      <span className="truncate">{label}</span>
    </span>
  );
}

export const PrazoBadge = DeadlineBadge;
