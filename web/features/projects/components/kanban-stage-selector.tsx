"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { ProjectStatus } from "@/features/projects/domain/project-types";
import { getStatusTheme } from "@/features/projects/domain/status-theme";

export type KanbanStage = { status: ProjectStatus; count: number };

type Props = {
  /** Etapas na ordem do Kanban de mesa, com as contagens da mesma lista filtrada. */
  stages: KanbanStage[];
  value: ProjectStatus;
  onChange: (status: ProjectStatus) => void;
  /** Filtro global de status ativo: a etapa é a do filtro e não se navega. */
  locked?: boolean;
};

const plural = (n: number) => `${n} ${n === 1 ? "projeto" : "projetos"}`;

const arrowClass =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-panel-soft dark:text-zinc-300 dark:hover:bg-white/8";

/** Seletor de etapa do Kanban no celular: uma etapa por vez, com anterior/próxima. */
export function KanbanStageSelector({ stages, value, onChange, locked = false }: Props) {
  const index = stages.findIndex((stage) => stage.status === value);
  const current = stages[index];
  const theme = getStatusTheme(value);
  const count = current?.count ?? 0;

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Etapa anterior"
          disabled={locked || index <= 0}
          onClick={() => onChange(stages[index - 1].status)}
          className={arrowClass}
        >
          <ChevronLeft size={18} />
        </button>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild disabled={locked}>
            <button
              type="button"
              aria-label={`Etapa: ${theme.label}, ${plural(count)}`}
              className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-left transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-70 dark:border-white/10 dark:bg-panel-soft dark:hover:bg-white/8"
            >
              <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${theme.accentBg}`} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900 dark:text-foreground">
                {theme.label}
              </span>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${theme.countPill}`}>
                {count}
              </span>
              {!locked && <ChevronDown size={14} className="shrink-0 text-zinc-400" />}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="center"
              sideOffset={6}
              collisionPadding={16}
              className="z-[120] w-[var(--radix-dropdown-menu-trigger-width)] min-w-[240px] rounded-xl border border-zinc-200 bg-white p-1 shadow-[0_20px_45px_-24px_rgba(0,0,0,0.45)] dark:border-white/8 dark:bg-panel"
            >
              <DropdownMenu.RadioGroup value={value} onValueChange={(next) => onChange(next as ProjectStatus)}>
                {stages.map((stage) => {
                  const stageTheme = getStatusTheme(stage.status);
                  return (
                    <DropdownMenu.RadioItem
                      key={stage.status}
                      value={stage.status}
                      aria-label={`${stageTheme.label}, ${plural(stage.count)}`}
                      className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-zinc-800 outline-none hover:bg-zinc-100 data-[highlighted]:bg-zinc-100 data-[state=checked]:font-semibold dark:text-zinc-300 dark:hover:bg-white/8 dark:data-[highlighted]:bg-white/8"
                    >
                      <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${stageTheme.accentBg}`} />
                      <span className="min-w-0 flex-1 truncate">{stageTheme.label}</span>
                      <span className="shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{stage.count}</span>
                      <span className="inline-flex w-4 shrink-0 justify-center">
                        <DropdownMenu.ItemIndicator>
                          <Check size={14} className="text-brand" />
                        </DropdownMenu.ItemIndicator>
                      </span>
                    </DropdownMenu.RadioItem>
                  );
                })}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <button
          type="button"
          aria-label="Próxima etapa"
          disabled={locked || index < 0 || index >= stages.length - 1}
          onClick={() => onChange(stages[index + 1].status)}
          className={arrowClass}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      {locked && (
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          Etapa definida pelo filtro de status. Remova o filtro para navegar entre as etapas.
        </p>
      )}
    </div>
  );
}
