"use client";

import type { ComponentType } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, Pencil, Power, Trash2 } from "lucide-react";

/**
 * Ação específica de uma entidade (ex.: "Gerenciar unidades" em Obras).
 * Definição ÚNICA: a tabela desenha o botão de ícone e o card mobile desenha o
 * item de menu a partir deste mesmo objeto.
 */
export type MasterDataRowAction = {
  key: string;
  /** Texto do item no menu do card. */
  label: string;
  /** title do botão da tabela. */
  title: string;
  /** Nome acessível do botão da tabela. */
  ariaLabel: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  onSelect: () => void;
};

type Props = {
  /** Identifica o registro no nome acessível do botão ⋯. */
  itemLabel: string;
  entityLabel: string;
  active: boolean;
  rowActions?: MasterDataRowAction[];
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
};

const ITEM_CLASS =
  "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-300 outline-none hover:bg-zinc-100 dark:hover:bg-white/8 data-[highlighted]:bg-zinc-100 dark:data-[highlighted]:bg-white/8";

/**
 * Menu ⋯ dos cards de Cadastros (celular). Chama exatamente os mesmos handlers
 * dos botões da tabela — nenhuma regra nova de permissão ou comportamento.
 */
export function MasterDataActionsMenu({ itemLabel, entityLabel, active, rowActions = [], onEdit, onToggle, onDelete }: Props) {
  const entity = entityLabel.toLowerCase();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Abrir ações de ${itemLabel}`}
          title="Mais ações"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 transition hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 dark:border-white/8 dark:bg-panel-soft dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <MoreHorizontal size={16} />
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
          className="z-[120] min-w-[210px] rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-1 shadow-[0_20px_45px_-24px_rgba(0,0,0,0.45)]"
        >
          {rowActions.length > 0 && (
            <>
              <DropdownMenu.Group>
                {rowActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <DropdownMenu.Item key={action.key} onSelect={action.onSelect} className={ITEM_CLASS}>
                      <Icon size={14} className="text-zinc-500" />
                      {action.label}
                    </DropdownMenu.Item>
                  );
                })}
              </DropdownMenu.Group>
              <DropdownMenu.Separator className="my-1 h-px bg-zinc-100 dark:bg-white/8" />
            </>
          )}
          <DropdownMenu.Group>
            <DropdownMenu.Item onSelect={onEdit} className={ITEM_CLASS}>
              <Pencil size={14} className="text-zinc-500" />
              Editar {entity}
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={onToggle} className={ITEM_CLASS}>
              <Power size={14} className={active ? "text-zinc-500" : "text-ok"} />
              {active ? `Inativar ${entity}` : `Reativar ${entity}`}
            </DropdownMenu.Item>
          </DropdownMenu.Group>
          <DropdownMenu.Separator className="my-1 h-px bg-zinc-100 dark:bg-white/8" />
          <DropdownMenu.Item onSelect={onDelete} className={`${ITEM_CLASS} text-red-600 dark:text-red-400`}>
            <Trash2 size={14} />
            Excluir permanentemente
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
