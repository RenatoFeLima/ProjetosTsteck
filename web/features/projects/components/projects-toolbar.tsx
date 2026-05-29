"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BarChart3, Building2, ChevronDown, Filter, Kanban, Search, Table2, UserRound, Wrench, X } from "lucide-react";
import { useMasterDataStore } from "@/features/master-data/state/master-data-store";
import type { ProjectStatus } from "@/features/projects/domain/project-types";
import type { ProjectsView } from "@/features/projects/state/projects-store";
import { SearchableCombobox } from "./searchable-combobox";

type ToolbarProps = {
  view: ProjectsView;
  onViewChange: (view: ProjectsView) => void;
  onClearFilters: () => void;
  tabCounts: { table: number; kanban: number; kpis: number; alerts: number };
  filters: {
    search: string;
    status: "all" | ProjectStatus;
    construtora: string;
    obra: string;
    vendedor: string;
    equipamento: string;
    atrasadoOnly: boolean;
    urgenteOnly: boolean;
  };
  onFiltersChange: (patch: Partial<ToolbarProps["filters"]>) => void;
};

const STATUS_OPTIONS: Array<{ label: string; value: "all" | ProjectStatus }> = [
  { label: "Todos status", value: "all" },
  { label: "Cadastro inicial", value: "CADASTRO INICIAL" },
  { label: "Elaborar", value: "ELABORAR ANTE-PROJETO" },
  { label: "Ante-projeto enviado", value: "ANTE-PROJETO ENVIADO" },
  { label: "Ante-projeto aprovado", value: "ANTE-PROJETO APROVADO" },
  { label: "Projeto aprovado", value: "PROJETO APROVADO" },
  { label: "Projeto final enviado", value: "PROJETO FINAL ENVIADO" },
  { label: "Revisao de estudo", value: "REVISAO DE ESTUDO" },
];

export function ProjectsToolbar({
  view,
  onViewChange,
  onClearFilters,
  tabCounts,
  filters,
  onFiltersChange,
}: ToolbarProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const quickFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status !== "all") count += 1;
    if (filters.construtora) count += 1;
    if (filters.obra) count += 1;
    if (filters.vendedor) count += 1;
    if (filters.equipamento) count += 1;
    if (filters.atrasadoOnly) count += 1;
    if (filters.urgenteOnly) count += 1;
    return count;
  }, [filters]);

  const viewButtons: Array<{ value: ProjectsView; label: string; icon: typeof Table2 }> = [
    { value: "table", label: "Tabela", icon: Table2 },
    { value: "kanban", label: "Kanban", icon: Kanban },
    { value: "kpis", label: "KPIs", icon: BarChart3 },
    { value: "alerts", label: "Alertas", icon: AlertTriangle },
  ];

  const statusPlaceholder = "Filtrar por status";

  const statusOptions = useMemo(
    () => STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
    [],
  );

  const masterData = useMasterDataStore();

  const construtoraOptions = useMemo(() => {
    const list = masterData.getActiveContrutoraNames();
    if (filters.construtora && !list.includes(filters.construtora)) {
      list.unshift(filters.construtora);
    }
    return Array.from(new Set(list)).map((value) => ({ value }));
  }, [masterData, filters.construtora]);

  const obraOptions = useMemo(() => {
    const list = masterData.getActiveObraNames();
    if (filters.obra && !list.includes(filters.obra)) {
      list.unshift(filters.obra);
    }
    return Array.from(new Set(list)).map((value) => ({ value }));
  }, [masterData, filters.obra]);

  const vendedorOptions = useMemo(() => {
    const list = masterData.getActiveVendedorNames();
    if (filters.vendedor && !list.includes(filters.vendedor)) {
      list.unshift(filters.vendedor);
    }
    return Array.from(new Set(list)).map((value) => ({ value }));
  }, [masterData, filters.vendedor]);

  const equipamentoOptions = useMemo(() => {
    const list = masterData.getActiveEquipamentoCodes();
    if (filters.equipamento && !list.includes(filters.equipamento)) {
      list.unshift(filters.equipamento);
    }
    return Array.from(new Set(list)).map((value) => ({ value }));
  }, [masterData, filters.equipamento]);

  return (
    <div className="space-y-2.5">
      {/* Abas de navegação */}
      <div className="flex items-center gap-0.5 overflow-x-auto rounded-xl border border-zinc-200/60 dark:border-white/8 bg-zinc-50/70 dark:bg-panel-soft/60 p-0.5">
        {viewButtons.map((item) => {
          const Icon = item.icon;
          const active = view === item.value;
          const count = tabCounts[item.value];

          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onViewChange(item.value)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition-all duration-150 ${
                active
                  ? "bg-white dark:bg-panel text-zinc-900 dark:text-foreground shadow-[0_1px_4px_rgba(0,0,0,0.10)] dark:shadow-none"
                  : "text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              <Icon
                size={14}
                className={active ? "text-brand" : ""}
              />
              {item.label}
              <span
                className={`tabular-nums text-[11px] ${
                  active ? "font-bold text-brand" : "text-zinc-400 dark:text-zinc-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-zinc-100 dark:border-white/8 bg-zinc-50/40 dark:bg-panel-soft/40 p-3">
        <div className="flex flex-wrap gap-2">
          <label className="group relative block min-w-0 flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400 transition group-focus-within:text-brand"
            />
            <input
              value={filters.search}
              onChange={(event) => onFiltersChange({ search: event.target.value })}
              aria-label="Buscar por codigo, construtora ou obra"
              placeholder="Buscar por codigo, construtora ou obra"
              className="h-9 w-full rounded-xl border border-zinc-200/70 dark:border-white/8 bg-white dark:bg-panel-soft pr-3 pl-9 text-[13px] outline-none transition placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:border-brand focus:ring-2 focus:ring-brand/10 dark:text-foreground"
            />
          </label>

          <div className="w-48 shrink-0">
          <SearchableCombobox
            value={filters.status}
            options={statusOptions}
            onChange={(value) => onFiltersChange({ status: value as ToolbarProps["filters"]["status"] })}
            placeholder={statusPlaceholder}
            searchPlaceholder="Buscar status..."
            emptyMessage="Nenhum status encontrado."
            ariaLabel="Filtrar por status"
          />
          </div>

          <button
            type="button"
            onClick={() => setAdvancedOpen((current) => !current)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 text-[13px] font-medium transition ${
              quickFilterCount > 0
                ? "border-brand/30 bg-brand/5 text-brand hover:bg-brand/10"
                : "border-zinc-200/70 dark:border-white/8 bg-white dark:bg-panel-soft text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
            }`}
          >
            <Filter size={13} />
            Filtros
            {quickFilterCount > 0 && (
              <span className="rounded-full bg-brand text-white px-1.5 py-0.5 text-[10px] font-bold">
                {quickFilterCount}
              </span>
            )}
            <ChevronDown size={13} className={`transition ${advancedOpen ? "rotate-180" : ""}`} />
          </button>

          {quickFilterCount > 0 && (
            <button
              type="button"
              onClick={onClearFilters}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-zinc-200/70 dark:border-white/8 bg-white dark:bg-panel-soft px-3 text-[13px] font-medium text-zinc-500 dark:text-zinc-400 transition hover:border-red-200 dark:hover:border-red-700/40 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
            >
              <X size={13} />
              Limpar filtros
            </button>
          )}
        </div>

        {advancedOpen && (
          <div className="md:grid-cols-2 xl:grid-cols-4 mt-3 grid gap-2">
            <SearchableCombobox
              value={filters.construtora}
              options={construtoraOptions}
              onChange={(value) => onFiltersChange({ construtora: value })}
              placeholder="Filtrar por construtora"
              searchPlaceholder="Buscar construtora..."
              emptyMessage="Nenhuma construtora encontrada."
              ariaLabel="Filtrar por construtora"
              leftIcon={<Building2 size={15} />}
            />

            <SearchableCombobox
              value={filters.obra}
              options={obraOptions}
              onChange={(value) => onFiltersChange({ obra: value })}
              placeholder="Filtrar por obra"
              searchPlaceholder="Buscar obra..."
              emptyMessage="Nenhuma obra encontrada."
              ariaLabel="Filtrar por obra"
              leftIcon={<Building2 size={15} />}
            />

            <SearchableCombobox
              value={filters.vendedor}
              options={vendedorOptions}
              onChange={(value) => onFiltersChange({ vendedor: value })}
              placeholder="Filtrar por vendedor"
              searchPlaceholder="Buscar vendedor..."
              emptyMessage="Nenhum vendedor encontrado."
              ariaLabel="Filtrar por vendedor"
              leftIcon={<UserRound size={15} />}
            />

            <SearchableCombobox
              value={filters.equipamento}
              options={equipamentoOptions}
              onChange={(value) => onFiltersChange({ equipamento: value })}
              placeholder="Filtrar por equipamento"
              searchPlaceholder="Buscar equipamento..."
              emptyMessage="Nenhum equipamento encontrado."
              ariaLabel="Filtrar por equipamento"
              leftIcon={<Wrench size={15} />}
            />

            <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white dark:bg-panel-soft px-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={filters.atrasadoOnly}
                onChange={(event) => onFiltersChange({ atrasadoOnly: event.target.checked })}
                className="h-4 w-4 accent-brand"
              />
              Apenas atrasados
            </label>

            <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white dark:bg-panel-soft px-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={filters.urgenteOnly}
                onChange={(event) => onFiltersChange({ urgenteOnly: event.target.checked })}
                className="h-4 w-4 accent-brand"
              />
              Apenas urgentes
            </label>
          </div>
        )}

      </div>
    </div>
  );
}
