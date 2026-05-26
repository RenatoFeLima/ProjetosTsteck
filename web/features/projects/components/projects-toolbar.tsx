"use client";

import type { ProjectStatus } from "@/features/projects/domain/project-types";
import type { ProjectsView } from "@/features/projects/state/projects-store";

type ToolbarProps = {
  view: ProjectsView;
  onViewChange: (view: ProjectsView) => void;
  onNewProject: () => void;
  filters: {
    search: string;
    status: "all" | ProjectStatus;
    construtora: string;
    vendedor: string;
    equipamento: string;
    atrasadoOnly: boolean;
    urgenteOnly: boolean;
  };
  onFiltersChange: (patch: Partial<ToolbarProps["filters"]>) => void;
};

const STATUS_OPTIONS: Array<{ label: string; value: "all" | ProjectStatus }> = [
  { label: "Todos status", value: "all" },
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
  onNewProject,
  filters,
  onFiltersChange,
}: ToolbarProps) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-panel/95 p-4 shadow-sm backdrop-blur-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onViewChange("table")}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
            view === "table" ? "bg-brand text-white" : "bg-zinc-100 text-zinc-700"
          }`}
        >
          Tabela
        </button>
        <button
          type="button"
          onClick={() => onViewChange("kanban")}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
            view === "kanban" ? "bg-brand text-white" : "bg-zinc-100 text-zinc-700"
          }`}
        >
          Kanban
        </button>
        <button
          type="button"
          onClick={() => onViewChange("alerts")}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
            view === "alerts" ? "bg-brand text-white" : "bg-zinc-100 text-zinc-700"
          }`}
        >
          Alertas
        </button>
        <button
          type="button"
          onClick={onNewProject}
          className="ml-auto rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
        >
          Novo Projeto
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-4">
        <input
          value={filters.search}
          onChange={(event) => onFiltersChange({ search: event.target.value })}
          placeholder="Buscar por codigo, construtora ou obra"
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-brand"
        />

        <select
          value={filters.status}
          onChange={(event) =>
            onFiltersChange({ status: event.target.value as ToolbarProps["filters"]["status"] })
          }
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-brand"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <input
          value={filters.construtora}
          onChange={(event) => onFiltersChange({ construtora: event.target.value })}
          placeholder="Construtora"
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-brand"
        />

        <input
          value={filters.vendedor}
          onChange={(event) => onFiltersChange({ vendedor: event.target.value })}
          placeholder="Vendedor"
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-brand"
        />

        <input
          value={filters.equipamento}
          onChange={(event) => onFiltersChange({ equipamento: event.target.value })}
          placeholder="Equipamento"
          className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-brand md:col-span-2"
        />

        <label className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm">
          <input
            type="checkbox"
            checked={filters.atrasadoOnly}
            onChange={(event) => onFiltersChange({ atrasadoOnly: event.target.checked })}
          />
          Apenas atrasados
        </label>

        <label className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm">
          <input
            type="checkbox"
            checked={filters.urgenteOnly}
            onChange={(event) => onFiltersChange({ urgenteOnly: event.target.checked })}
          />
          Apenas urgentes
        </label>
      </div>
    </section>
  );
}
