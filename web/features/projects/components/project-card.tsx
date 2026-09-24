import type { Project } from "@/features/projects/domain/project-types";
import { shouldShowOperationalDeadline } from "@/features/projects/domain/project-rules";
import { activeRemindersForProject } from "@/features/projects/domain/project-reminders";
import { useProjectsStore } from "@/features/projects/state/projects-store";
import { Skeleton } from "@/features/ui/skeleton";
import { cn } from "@/lib/utils";
import { DeadlineBadge, StatusBadge, UrgenteBadge } from "./pill-badges";
import { ProjectActionsMenu, type ProjectActionHandlers } from "./project-actions-menu";
import { ReminderPill } from "./reminder-badges";

type ProjectCardProps = ProjectActionHandlers & {
  project: Project;
  onRequestRemoveUrgency: (project: Project) => void;
};

/**
 * Card de projeto do celular (< 768px). Só apresentação: recebe o projeto já
 * filtrado/ordenado/paginado pela ProjectsTable e os MESMOS handlers da linha.
 * Composição dos badges existentes — nenhuma regra de SLA/urgência aqui.
 *
 * Acessibilidade: o código é um <button> real que cobre o card (::after), então
 * o card inteiro abre os detalhes (clique, Enter, Espaço) sem botões aninhados;
 * o menu ⋯ fica acima dessa camada e não abre o projeto.
 */
export function ProjectCard({ project, onRequestRemoveUrgency, ...handlers }: ProjectCardProps) {
  // Lembretes já carregados no store (mesmo indicador do Kanban) — sem request.
  const reminders = useProjectsStore((state) => state.reminders);
  const activeReminders = activeRemindersForProject(reminders, project.id);
  const topReminder = activeReminders[0] ?? null;
  const obraLabel = project.unidade_obra ? `${project.obra} · ${project.unidade_obra}` : project.obra;

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border border-line shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)]",
        project.urgente ? "bg-red-50/40 dark:bg-red-900/10" : "bg-white dark:bg-panel",
      )}
    >
      {project.urgente && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-[#9e0b0f]" />}

      <div className="py-3 pr-2 pl-4">
        <div className="flex items-start gap-2">
          <h3 className="min-w-0 flex-1 pt-2.5">
            <button
              type="button"
              aria-label={`Abrir projeto ${project.codigo_projeto}`}
              onClick={() => handlers.onViewDetails(project)}
              className={cn(
                "text-left font-mono text-[13px] font-bold leading-tight break-all text-zinc-900 dark:text-foreground",
                "after:absolute after:inset-0 after:rounded-2xl after:content-['']",
                // O `button:active { transform: scale(.98) }` global tornaria o botão o
                // bloco de referência do ::after: no toque a camada encolheria para o
                // código e o "soltar" cairia fora do botão (clique perdido).
                "active:transform-none!",
                "focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-brand/40",
              )}
            >
              {project.codigo_projeto}
            </button>
          </h3>
          {/* Acima da camada clicável do card. */}
          <div className="relative z-10 shrink-0">
            <ProjectActionsMenu
              project={project}
              {...handlers}
              onRequestRemoveUrgency={onRequestRemoveUrgency}
              triggerClassName="inline-flex h-11 w-11 items-center justify-center p-0"
            />
          </div>
        </div>

        <p title={project.construtora} className="mt-0.5 line-clamp-2 break-words pr-2 text-[13px] font-semibold leading-snug text-zinc-800 dark:text-foreground">
          {project.construtora}
        </p>
        <p title={obraLabel} className="truncate pr-2 text-xs text-zinc-500 dark:text-muted">
          {project.obra}
          {project.unidade_obra && <span className="text-zinc-400 dark:text-zinc-500"> · {project.unidade_obra}</span>}
        </p>

        {/* max-w-full nos filhos: nenhum badge extrapola o card. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pr-2 [&>span]:max-w-full">
          <StatusBadge status={project.status_atual} />
          {project.urgente && <UrgenteBadge urgente urgentDeadline={project.urgentDeadline} />}
          {topReminder && <ReminderPill reminder={topReminder} extraCount={activeReminders.length - 1} />}
        </div>

        <dl className="mt-2.5 grid gap-1 pr-2 text-xs">
          <div className="flex min-w-0 items-baseline gap-1">
            <dt className="shrink-0 text-zinc-400 dark:text-zinc-500">Vendedor:</dt>
            <dd title={project.vendedor} className="min-w-0 truncate font-medium text-zinc-700 dark:text-zinc-300">
              {project.vendedor}
            </dd>
          </div>
          {/* Mesma regra do DeadlineBadge: só com SLA ativo e sem urgência. */}
          {shouldShowOperationalDeadline(project) && (
            <div className="flex min-w-0 items-center gap-1">
              <dt className="shrink-0 text-zinc-400 dark:text-zinc-500">Prazo:</dt>
              <dd className="min-w-0">
                <DeadlineBadge project={project} />
              </dd>
            </div>
          )}
        </dl>
      </div>
    </article>
  );
}

/** Placeholder de card para a 1ª carga no celular (sem "0"/vazio falso). */
export function ProjectCardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 dark:bg-panel">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-8" />
      </div>
      <Skeleton className="mt-2 h-3.5 w-3/5" />
      <Skeleton className="mt-1.5 h-3 w-2/5" />
      <div className="mt-3 flex gap-1.5">
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-3 w-1/2" />
    </div>
  );
}
