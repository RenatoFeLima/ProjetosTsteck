import { computePrazoBadge, computePrazoEntrega, todayIsoDate } from "@/features/projects/domain/project-rules";
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Project, ProjectStatus } from "@/features/projects/domain/project-types";
import { format, isValid } from "date-fns";

const BASE_BADGE_CLASS =
  "inline-flex h-7 max-w-full items-center whitespace-nowrap overflow-hidden text-ellipsis rounded-full border px-2.5 text-[11px] font-semibold tracking-wide";

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const styleMap: Record<ProjectStatus, string> = {
    "CADASTRO INICIAL":         "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300",
    "ELABORAR ANTE-PROJETO":    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-700/50 dark:bg-sky-900/30 dark:text-sky-300",
    "ANTE-PROJETO ENVIADO":     "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700/50 dark:bg-violet-900/30 dark:text-violet-300",
    "ANTE-PROJETO APROVADO":    "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-700/50 dark:bg-purple-900/30 dark:text-purple-300",
    "PROJETO APROVADO":         "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-300",
    "PROJETO FINAL ENVIADO":    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/30 dark:text-emerald-300",
    "REVISAO DE ESTUDO":        "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-700/50 dark:bg-orange-900/30 dark:text-orange-300",
  };

  return (
    <span title={status} className={`${BASE_BADGE_CLASS} max-w-[165px] ${styleMap[status]}`}>
      <span className="truncate">{status}</span>
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

function getDeadlineTooltip(delta: number | null, prazo: string | null): string {
  if (!prazo || delta === null) return "Este projeto ainda nao possui prazo definido.";
  if (delta < 0) {
    const dueDateLabel = formatDateLabel(prazo);
    return `Projeto atrasado ha ${Math.abs(delta)} dias. Prazo vencido em ${dueDateLabel}.`;
  }
  return `Faltam ${delta} dias para o prazo do projeto.`;
}

export function DeadlineBadge({ project }: { project: Project }) {
  const today = todayIsoDate();
  const prazo = computePrazoEntrega(project.data_alinhamento, project.proj_obra_recebido && project.local_cabine_definido);
  const badge = computePrazoBadge(today, prazo);
  const delta = prazo ? differenceInCalendarDays(parseISO(prazo), parseISO(today)) : null;

  const label =
    delta === null
      ? "Sem prazo"
      : delta < 0
        ? `${Math.abs(delta)}d atraso`
        : `${delta}d restantes`;

  const tooltip = getDeadlineTooltip(delta, prazo);

  const className =
    badge === "atrasado"
      ? "border-red-300 bg-red-100 text-red-700 dark:border-red-700/50 dark:bg-red-900/30 dark:text-red-300"
      : typeof delta === "number" && delta <= 7
        ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-700/50 dark:bg-rose-900/30 dark:text-rose-300"
        : badge === "atencao"
          ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-300"
        : badge === "no_prazo"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/30 dark:text-emerald-300"
          : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700/50 dark:bg-zinc-800/40 dark:text-zinc-400";

  return (
    <span title={tooltip} className={`${BASE_BADGE_CLASS} max-w-[120px] ${className}`}>
      <span className="truncate">{label}</span>
    </span>
  );
}

export const PrazoBadge = DeadlineBadge;
