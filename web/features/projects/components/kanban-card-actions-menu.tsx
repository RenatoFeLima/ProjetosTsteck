"use client";

import type { SyntheticEvent } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowRight, BellPlus, Eye, MoreHorizontal } from "lucide-react";
import type { Project, ProjectStatus } from "@/features/projects/domain/project-types";
import { getStatusTheme } from "@/features/projects/domain/status-theme";
import { cn } from "@/lib/utils";

type Props = {
  project: Project;
  onOpen: (project: Project) => void;
  /** Destinos do fluxo já liberados para o usuário (vazio = sem movimentação). */
  destinations: ProjectStatus[];
  /** Entrega a escolha ao MESMO fluxo do arraste (requestMove do Kanban). */
  onMove: (project: Project, nextStatus: ProjectStatus) => void;
  /** Presente só para quem já pode criar lembretes hoje. */
  onCreateReminder?: (project: Project) => void;
  /** Classes do contêiner (ex.: visível só em ponteiro grosso no Kanban de mesa). */
  className?: string;
};

/** O menu só existe se oferecer algo além de "Ver detalhes" (o card já abre os detalhes). */
export function hasKanbanCardActions(destinations: ProjectStatus[], onCreateReminder?: unknown): boolean {
  return destinations.length > 0 || Boolean(onCreateReminder);
}

const itemClass =
  "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-800 outline-none pointer-coarse:min-h-11 hover:bg-zinc-100 data-[highlighted]:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/8 dark:data-[highlighted]:bg-white/8";

// Eventos do menu (inclusive do conteúdo em portal, que borbulha pela árvore do
// React) não podem chegar ao card: nem iniciar arraste, nem abrir por duplo clique.
const stop = (event: SyntheticEvent) => event.stopPropagation();

/**
 * Menu ⋯ do card do Kanban: ver detalhes, mover para os destinos permitidos e
 * criar lembrete. Não decide nada sobre a transição — só chama `onMove`.
 */
export function KanbanCardActionsMenu({ project, onOpen, destinations, onMove, onCreateReminder, className }: Props) {
  return (
    <span
      className={cn("relative z-10 -my-3 -mr-2 inline-flex shrink-0", className)}
      onPointerDown={stop}
      onClick={stop}
      onDoubleClick={stop}
    >
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={`Abrir ações de ${project.codigo_projeto}`}
            title="Mais ações"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 dark:text-zinc-400 dark:hover:bg-white/8 dark:hover:text-zinc-200"
          >
            <MoreHorizontal size={16} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="bottom"
            align="end"
            sideOffset={4}
            collisionPadding={16}
            className="z-[120] min-w-[220px] rounded-xl border border-zinc-200 bg-white p-1 shadow-[0_20px_45px_-24px_rgba(0,0,0,0.45)] dark:border-white/8 dark:bg-panel"
          >
            <DropdownMenu.Item onSelect={() => onOpen(project)} className={itemClass}>
              <Eye size={14} className="text-zinc-500" />
              Ver detalhes
            </DropdownMenu.Item>

            {destinations.length > 0 && (
              <>
                <DropdownMenu.Separator className="my-1 h-px bg-zinc-100 dark:bg-white/8" />
                <DropdownMenu.Group>
                  <DropdownMenu.Label className="px-2 pt-1 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                    Mover para
                  </DropdownMenu.Label>
                  {destinations.map((status) => {
                    const theme = getStatusTheme(status);
                    return (
                      <DropdownMenu.Item
                        key={status}
                        aria-label={`Mover para ${theme.label}`}
                        onSelect={() => onMove(project, status)}
                        className={itemClass}
                      >
                        <ArrowRight size={14} className="text-zinc-500" />
                        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${theme.accentBg}`} />
                        {theme.label}
                      </DropdownMenu.Item>
                    );
                  })}
                </DropdownMenu.Group>
              </>
            )}

            {onCreateReminder && (
              <>
                <DropdownMenu.Separator className="my-1 h-px bg-zinc-100 dark:bg-white/8" />
                <DropdownMenu.Item onSelect={() => onCreateReminder(project)} className={itemClass}>
                  <BellPlus size={14} className="text-zinc-500" />
                  Criar lembrete
                </DropdownMenu.Item>
              </>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </span>
  );
}
