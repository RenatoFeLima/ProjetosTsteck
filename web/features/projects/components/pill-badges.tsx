import { getStatusTheme } from "@/features/projects/domain/status-theme";
import { getCurrentStatusDeadline } from "@/features/projects/domain/project-rules";
import type { Project, ProjectStatus } from "@/features/projects/domain/project-types";
import { format, isValid, parseISO } from "date-fns";

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

export function UrgenteBadge({ urgente }: { urgente: boolean }) {
  if (!urgente) return null;
  return (
    <span className={`${BASE_BADGE_CLASS} gap-1 border-red-200 bg-red-50 text-[#9e0b0f] dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300`}>
      <span className="h-1.5 w-1.5 rounded-full bg-[#9e0b0f]" />
      Urgente
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
