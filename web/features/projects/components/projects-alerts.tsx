import { AlertTriangle, BellRing, Clock3 } from "lucide-react";
import { computeNextAction, getCurrentStatusDeadline } from "@/features/projects/domain/project-rules";
import {
  buildAlertGroups,
  type AlertSeverity,
  type AlertType,
} from "@/features/projects/domain/project-alerts";
import type { Project } from "@/features/projects/domain/project-types";
import { PrazoBadge, StatusBadge, UrgenteBadge } from "./pill-badges";

type ProjectsAlertsProps = {
  projects: Project[];
  onOpen: (project: Project) => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
};

const SEVERITY_META: Record<AlertSeverity, { label: string; chip: string; dot: string }> = {
  critico: {
    label: "Crítico",
    chip: "border-red-200 bg-red-50 text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300",
    dot: "bg-[#9e0b0f]",
  },
  atencao: {
    label: "Atenção",
    chip: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  informativo: {
    label: "Informativo",
    chip: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-700/40 dark:bg-sky-900/20 dark:text-sky-300",
    dot: "bg-sky-500",
  },
};

const TYPE_LABEL: Record<AlertType, string> = {
  prazo: "Prazo",
  urgencia: "Urgência",
  revisao: "Revisão",
  cadastro: "Cadastro",
  qualidade: "Qualidade de dados",
};

export function ProjectsAlerts({ projects, onOpen, loading, error, onRetry }: ProjectsAlertsProps) {
  if (loading) {
    return (
      <div className="grid gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-line bg-zinc-50 dark:bg-panel-soft"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-700/50 bg-red-50 dark:bg-red-900/20 p-6 text-center">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
          <AlertTriangle size={16} />
          Não foi possível carregar os alertas.
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-xl border border-red-300 dark:border-red-700/50 bg-white dark:bg-panel-soft px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-300 transition hover:bg-red-50 dark:hover:bg-white/8"
          >
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  const groups = buildAlertGroups(projects);

  if (groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-white/15 bg-white dark:bg-panel p-8 text-center text-sm text-zinc-500 dark:text-muted">
        Nenhum alerta no momento.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {groups.map((group) => {
        const sev = SEVERITY_META[group.severity];
        return (
          <section
            key={group.key}
            className="rounded-2xl border border-line bg-white dark:bg-panel p-3 shadow-[0_12px_24px_-22px_rgba(0,0,0,0.45)]"
          >
            <header className="mb-3 flex items-start justify-between gap-2 border-b border-zinc-100 dark:border-white/8 pb-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-foreground">{group.title}</h3>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sev.chip}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                    {sev.label}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
                    {TYPE_LABEL[group.type]}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-muted">{group.helper}</p>
              </div>
              <span className="shrink-0 rounded-full border border-zinc-200 dark:border-white/8 bg-zinc-100 dark:bg-white/8 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {group.projects.length}
              </span>
            </header>

            <div className="grid gap-2">
              {group.projects.map((project) => {
                const hasDeadline = getCurrentStatusDeadline(project).hasDeadline;
                return (
                  <article
                    key={`${group.key}-${project.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpen(project)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpen(project);
                      }
                    }}
                    className={`cursor-pointer rounded-xl border bg-white dark:bg-panel-soft p-3 transition hover:-translate-y-0.5 hover:shadow-[0_16px_24px_-20px_rgba(0,0,0,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e0b0f]/40 ${
                      project.urgente ? "border-red-200 dark:border-red-700/50" : "border-line"
                    }`}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 dark:bg-white/8 text-zinc-700 dark:text-zinc-300">
                        <BellRing size={14} />
                      </span>
                      <strong className="font-display text-base tracking-tight text-zinc-900 dark:text-foreground">
                        {project.codigo_projeto}
                      </strong>
                      {project.urgente && <UrgenteBadge urgente urgentDeadline={project.urgentDeadline} />}
                      <StatusBadge status={project.status_atual} />
                    </div>

                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      {project.construtora} - {project.obra}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {/* "Sem prazo" não é exibido aqui: só mostra o prazo quando a etapa tem SLA. */}
                      {hasDeadline && <PrazoBadge project={project} />}
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${sev.chip}`}>
                        <Clock3 size={12} />
                        {group.title}
                      </span>
                    </div>

                    <div className="mt-2 rounded-lg border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">Próxima ação:</span>{" "}
                      {computeNextAction(project)}
                    </div>

                    <p className="mt-2 inline-flex items-start gap-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" />
                      Ação recomendada: {group.action}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
