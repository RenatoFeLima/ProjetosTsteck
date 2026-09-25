"use client";

import { Fragment, useState } from "react";
import { ChevronRight, Power, Pencil, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MasterEntity } from "@/features/master-data/domain/master-data-types";
import { useViewportMode } from "@/features/sidebar/hooks/use-viewport-mode";
import { MasterDataActionsMenu, type MasterDataRowAction } from "./master-data-actions-menu";

type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (item: T) => React.ReactNode;
};

/**
 * Card do celular (< 768px) montado a partir das COLUNAS existentes (mesmo
 * `render`, sem duplicar formatação). Cada entrada de `details` é uma linha;
 * um array de chaves vira "valor · valor" na mesma linha.
 */
export type MasterDataCardConfig = {
  title: string;
  subtitle?: string;
  details?: Array<string | string[]>;
  /** Coluna exibida no botão de expandir (ex.: "unidades" → "3 unidades"). */
  expandToggle?: string;
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
  /**
   * Ações específicas da entidade, renderizadas ANTES do botão Editar de cada
   * linha (e como itens do menu ⋯ no card mobile). Definição única.
   */
  rowActions?: (item: T) => MasterDataRowAction[];
  /**
   * Habilita linhas expansíveis (setinha ▸/▾ na 1ª coluna). Quando informado,
   * renderiza o conteúdo-filho da linha expandida. A seta SOMENTE expande/recolhe
   * — não dispara nenhuma outra ação. Várias linhas podem ficar abertas.
   * Sem esta prop, a tabela se comporta exatamente como antes.
   */
  renderExpanded?: (item: T) => React.ReactNode;
  /** Rótulo acessível da seta (ex.: "unidades de ADOLFO PINHEIRO"). */
  expandLabel?: (item: T) => string;
  /** Apresentação em card no celular. Sem ela, o celular continua com a tabela. */
  card?: MasterDataCardConfig;
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
  rowActions,
  renderExpanded,
  expandLabel,
  card,
}: Props<T>) {
  const activeCount = items.filter((i) => i.active).length;
  const expandable = Boolean(renderExpanded);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // < 768px: cards (quando a página configura `card`); ≥ 768px: tabela. Uma
  // apresentação por vez, a partir dos MESMOS itens (já filtrados pela página);
  // o estado de expansão é o mesmo nas duas, então trocar de faixa não o perde.
  const showCards = useViewportMode() === "mobile" && Boolean(card);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function cell(item: T, key: string): React.ReactNode {
    const col = columns.find((c) => String(c.key) === key);
    if (col?.render) return col.render(item);
    return String((item as Record<string, unknown>)[key] ?? "");
  }

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

      {showCards && card ? (
        items.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white px-4 py-8 text-center text-sm text-zinc-400 dark:bg-panel">
            Nenhum registro encontrado.
          </div>
        ) : (
          // grid-cols-1 = minmax(0, 1fr): textos longos com truncate não alargam a lista.
          <ul aria-label={entityLabel} className="grid grid-cols-1 gap-3">
            {items.map((item) => (
              <li key={item.id}>
                <MasterDataCard
                  item={item}
                  config={card}
                  cell={cell}
                  entityLabel={entityLabel}
                  rowActions={rowActions?.(item)}
                  onEdit={() => onEdit(item)}
                  onToggle={() => onToggle(item)}
                  onDelete={() => onDelete(item)}
                  expandable={expandable}
                  isExpanded={expandedIds.has(item.id)}
                  onToggleExpanded={() => toggleExpanded(item.id)}
                  expandAriaLabel={expandLabel?.(item) ?? entityLabel.toLowerCase()}
                  renderExpanded={renderExpanded}
                />
              </li>
            ))}
          </ul>
        )
      ) : (
      /* Table — rolagem horizontal confinada aqui (nunca na página). */
      <div className="overflow-x-auto rounded-2xl border border-line bg-white dark:bg-panel">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-zinc-50 dark:bg-panel-soft">
              {expandable && <th className="w-10 px-2 py-3" aria-label="Expandir" />}
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
                  colSpan={columns.length + 1 + (expandable ? 1 : 0)}
                  className="px-4 py-8 text-center text-sm text-zinc-400"
                >
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const isExpanded = expandedIds.has(item.id);
                return (
                <Fragment key={item.id}>
                <tr
                  className={cn(
                    "border-b border-line transition-colors",
                    item.active ? "bg-white dark:bg-panel hover:bg-zinc-50 dark:hover:bg-white/5" : "bg-zinc-50/60 dark:bg-panel-soft/60 opacity-60 hover:opacity-80",
                  )}
                >
                  {expandable && (
                    <td className="w-10 px-2 py-3">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(item.id)}
                        title={isExpanded ? "Recolher" : "Expandir"}
                        aria-expanded={isExpanded}
                        aria-label={`${isExpanded ? "Recolher" : "Expandir"} ${expandLabel?.(item) ?? entityLabel.toLowerCase()}`}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/8 dark:hover:text-foreground"
                      >
                        <ChevronRight
                          size={15}
                          className={cn("transition-transform", isExpanded && "rotate-90")}
                        />
                      </button>
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                      {col.render
                        ? col.render(item)
                        : String((item as Record<string, unknown>)[String(col.key)] ?? "")}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {rowActions?.(item).map((action) => {
                        const Icon = action.icon;
                        return (
                          <button
                            key={action.key}
                            type="button"
                            title={action.title}
                            aria-label={action.ariaLabel}
                            onClick={action.onSelect}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/8 dark:hover:text-foreground"
                          >
                            <Icon size={14} />
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        title={`Editar ${entityLabel.toLowerCase()}`}
                        aria-label={`Editar ${entityLabel.toLowerCase()}`}
                        onClick={() => onEdit(item)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 transition hover:bg-zinc-100 dark:hover:bg-white/8 hover:text-zinc-900 dark:hover:text-foreground"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        title={item.active ? `Inativar ${entityLabel.toLowerCase()}` : `Reativar ${entityLabel.toLowerCase()}`}
                        aria-label={item.active ? `Inativar ${entityLabel.toLowerCase()}` : `Reativar ${entityLabel.toLowerCase()}`}
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
                        aria-label="Excluir permanentemente"
                        onClick={() => onDelete(item)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                {expandable && isExpanded && (
                  <tr className="border-b border-line bg-zinc-50/50 dark:bg-panel-soft/40">
                    <td />
                    <td colSpan={columns.length} className="px-4 py-2">
                      {renderExpanded!(item)}
                    </td>
                  </tr>
                )}
                </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

// Valores vazios/placeholder não geram "— · —" no card.
function hasValue(node: React.ReactNode) {
  return node !== null && node !== undefined && node !== false && node !== "" && node !== "—";
}

type MasterDataCardProps<T extends MasterEntity> = {
  item: T;
  config: MasterDataCardConfig;
  cell: (item: T, key: string) => React.ReactNode;
  entityLabel: string;
  rowActions?: MasterDataRowAction[];
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  expandable: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  expandAriaLabel: string;
  renderExpanded?: (item: T) => React.ReactNode;
};

/**
 * Card de um registro de Cadastro (celular). Não é clicável — como a linha da
 * tabela; as interações ficam no ⋯ e, quando houver, no botão de expandir.
 */
function MasterDataCard<T extends MasterEntity>({
  item,
  config,
  cell,
  entityLabel,
  rowActions,
  onEdit,
  onToggle,
  onDelete,
  expandable,
  isExpanded,
  onToggleExpanded,
  expandAriaLabel,
  renderExpanded,
}: MasterDataCardProps<T>) {
  const title = cell(item, config.title);
  const subtitle = config.subtitle ? cell(item, config.subtitle) : null;
  const status = cell(item, "active");
  const itemLabel = String((item as Record<string, unknown>)[config.title] ?? entityLabel);

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-line shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04)] transition-colors",
        // Mesmo tratamento de inativo da linha da tabela.
        item.active ? "bg-white dark:bg-panel" : "bg-zinc-50/60 dark:bg-panel-soft/60 opacity-60 hover:opacity-80",
      )}
    >
      <div className="py-3 pr-2 pl-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 pt-2">
            <h3 className="line-clamp-2 break-words text-sm font-semibold leading-snug text-zinc-900 dark:text-foreground">
              {title}
            </h3>
            {hasValue(subtitle) && (
              <p className="mt-0.5 line-clamp-2 break-words text-xs text-zinc-600 dark:text-zinc-400">{subtitle}</p>
            )}
          </div>
          <div className="shrink-0">
            <MasterDataActionsMenu
              itemLabel={itemLabel}
              entityLabel={entityLabel}
              active={item.active}
              rowActions={rowActions}
              onEdit={onEdit}
              onToggle={onToggle}
              onDelete={onDelete}
            />
          </div>
        </div>

        {config.details?.map((line, index) => {
          const keys = Array.isArray(line) ? line : [line];
          const parts = keys.map((key) => cell(item, key)).filter(hasValue);
          if (parts.length === 0) return null;
          return (
            <p key={index} className="mt-1 truncate pr-2 text-xs text-zinc-500 dark:text-muted">
              {parts.map((part, i) => (
                <Fragment key={i}>
                  {i > 0 && <span className="text-zinc-300 dark:text-zinc-600"> · </span>}
                  {part}
                </Fragment>
              ))}
            </p>
          );
        })}

        <div className="mt-2.5 flex flex-wrap items-center gap-2 pr-2">
          {status}
          {expandable && config.expandToggle && (
            <button
              type="button"
              onClick={onToggleExpanded}
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? "Recolher" : "Expandir"} ${expandAriaLabel}`}
              className="-my-1 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/8"
            >
              <ChevronRight size={14} className={cn("transition-transform", isExpanded && "rotate-90")} />
              {cell(item, config.expandToggle)}
            </button>
          )}
        </div>
      </div>

      {expandable && isExpanded && renderExpanded && (
        <div className="border-t border-line bg-zinc-50/50 px-4 py-2 dark:bg-panel-soft/40">{renderExpanded(item)}</div>
      )}
    </article>
  );
}
