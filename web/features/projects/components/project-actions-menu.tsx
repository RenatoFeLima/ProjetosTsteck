import type { Project } from "@/features/projects/domain/project-types";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CircleDot, Eye, History, MoreHorizontal, PencilLine, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectActionHandlers = {
  onViewDetails: (project: Project) => void;
  /** Ausente = sem permissão → item desabilitado. */
  onEditProject?: (project: Project) => void;
  onChangeStatus?: (project: Project) => void;
  onMarkUrgente?: (project: Project) => void;
  onViewHistory: (project: Project) => void;
};

type Props = ProjectActionHandlers & {
  project: Project;
  /** Remover urgência passa pela confirmação (estado único na ProjectsTable). */
  onRequestRemoveUrgency: (project: Project) => void;
  /** Classes extras do botão ⋯ (ex.: alvo de 44px no card mobile). */
  triggerClassName?: string;
};

/**
 * Menu ⋯ de ações do projeto — o MESMO para a linha da tabela e o card mobile.
 * As regras de habilitação ficam só aqui (permissão = handler presente).
 */
export function ProjectActionsMenu({
  project,
  onViewDetails,
  onEditProject,
  onChangeStatus,
  onMarkUrgente,
  onViewHistory,
  onRequestRemoveUrgency,
  triggerClassName,
}: Props) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Abrir acoes do projeto"
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "rounded-lg border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel-soft p-1.5 text-zinc-600 dark:text-zinc-400 transition hover:text-zinc-900 dark:hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
            triggerClassName,
          )}
          title="Mais acoes"
        >
          <MoreHorizontal size={14} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="end"
          sideOffset={8}
          collisionPadding={16}
          avoidCollisions={true}
          sticky="always"
          className="z-[120] min-w-[190px] rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-1 shadow-[0_20px_45px_-24px_rgba(0,0,0,0.45)]"
        >
          <DropdownMenu.Group>
            <DropdownMenu.Item
              onSelect={() => onViewDetails(project)}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-300 outline-none hover:bg-zinc-100 dark:hover:bg-white/8"
            >
              <Eye size={14} className="text-zinc-500 dark:text-zinc-500" />
              Ver detalhes
            </DropdownMenu.Item>
            <DropdownMenu.Item
              disabled={!onEditProject}
              onSelect={() => onEditProject?.(project)}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-300 outline-none hover:bg-zinc-100 dark:hover:bg-white/8 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
            >
              <PencilLine size={14} className="text-zinc-500 dark:text-zinc-500" />
              Editar projeto
            </DropdownMenu.Item>
          </DropdownMenu.Group>
          <DropdownMenu.Separator className="my-1 h-px bg-zinc-100 dark:bg-white/8" />
          <DropdownMenu.Group>
            <DropdownMenu.Item
              disabled={project.status_atual === "PROJETO APROVADO" || !onChangeStatus}
              onSelect={() => onChangeStatus?.(project)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-300 outline-none hover:bg-zinc-100 dark:hover:bg-white/8 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
            >
              <Workflow size={14} className="text-zinc-500 dark:text-zinc-500" />
              Alterar status
            </DropdownMenu.Item>
            <DropdownMenu.Item
              disabled={project.status_atual === "PROJETO APROVADO" || !onMarkUrgente}
              onSelect={() => {
                if (project.urgente) {
                  onRequestRemoveUrgency(project);
                  return;
                }
                onMarkUrgente?.(project);
              }}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none hover:bg-zinc-100 dark:hover:bg-white/8 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
            >
              <CircleDot size={14} className={project.urgente ? "text-amber-600" : "text-zinc-500"} />
              {project.urgente ? "Remover urgencia" : "Marcar como urgente"}
            </DropdownMenu.Item>
          </DropdownMenu.Group>
          <DropdownMenu.Separator className="my-1 h-px bg-zinc-100 dark:bg-white/8" />
          <DropdownMenu.Group>
            <DropdownMenu.Item
              onSelect={() => onViewHistory(project)}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-300 outline-none hover:bg-zinc-100 dark:hover:bg-white/8"
            >
              <History size={14} className="text-zinc-500 dark:text-zinc-500" />
              Ver historico
            </DropdownMenu.Item>
          </DropdownMenu.Group>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
