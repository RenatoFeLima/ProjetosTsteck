"use client";

import { Power, Pencil, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MasterEntity } from "@/features/master-data/domain/master-data-types";

type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (item: T) => React.ReactNode;
};

type Props<T extends MasterEntity> = {
  items: T[];
  columns: Column<T>[];
  onAdd: () => void;
  onEdit: (item: T) => void;
  onToggle: (item: T) => void;
  onDelete: (item: T) => void;
  entityLabel: string;
  searchValue: string;
  onSearch: (v: string) => void;
};

export function MasterDataTable<T extends MasterEntity>({
  items,
  columns,
  onAdd,
  onEdit,
  onToggle,
  onDelete,
  entityLabel,
  searchValue,
  onSearch,
}: Props<T>) {
  const activeCount = items.filter((i) => i.active).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={searchValue}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={`Buscar ${entityLabel.toLowerCase()}...`}
          className="h-10 flex-1 min-w-[200px] rounded-xl border border-line bg-white dark:bg-panel-soft dark:text-foreground dark:placeholder:text-zinc-600 px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
          aria-label={`Buscar ${entityLabel}`}
        />
        <span className="text-sm text-zinc-500">
          {activeCount} ativo{activeCount !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand"
        >
          <Plus size={16} />
          Adicionar {entityLabel}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white dark:bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-zinc-50 dark:bg-panel-soft">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-zinc-500"
                >
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-zinc-500">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-8 text-center text-sm text-zinc-400"
                >
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b border-line transition-colors last:border-0",
                    item.active ? "bg-white dark:bg-panel hover:bg-zinc-50 dark:hover:bg-white/5" : "bg-zinc-50/60 dark:bg-panel-soft/60 opacity-60 hover:opacity-80",
                  )}
                >
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {col.render
                        ? col.render(item)
                        : String((item as Record<string, unknown>)[String(col.key)] ?? "")}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        title="Editar"
                        onClick={() => onEdit(item)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-white/8 hover:text-zinc-900 dark:hover:text-foreground"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        title={item.active ? "Desativar" : "Ativar"}
                        onClick={() => onToggle(item)}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg transition",
                          item.active
                            ? "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/8 hover:text-zinc-900 dark:hover:text-foreground"
                            : "text-ok hover:bg-ok/10",
                        )}
                      >
                        <Power size={14} />
                      </button>
                      <button
                        type="button"
                        title="Excluir permanentemente"
                        onClick={() => onDelete(item)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
