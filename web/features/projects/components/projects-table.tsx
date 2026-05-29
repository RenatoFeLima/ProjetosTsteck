import type { Project } from "@/features/projects/domain/project-types";
import { useMemo, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { computeNextAction } from "@/features/projects/domain/project-rules";
import { AlertTriangle, ArrowDownWideNarrow, ChevronLeft, ChevronRight, CircleDot, Copy, Eye, History, LoaderCircle, MoreHorizontal, PencilLine, RotateCcw, Workflow } from "lucide-react";
import { DeadlineBadge, StatusBadge, UrgenteBadge } from "./pill-badges";
import { UrgencyJustificationDialog } from "./urgency-justification-dialog";
import { RemoveUrgencyConfirmDialog } from "./remove-urgency-confirm-dialog";

type ProjectsTableProps = {
  projects: Project[];
  onViewDetails: (project: Project) => void;
  onEditProject: (project: Project) => void;
  onChangeStatus: (project: Project) => void;
  onViewHistory: (project: Project) => void;
  onMarkUrgente: (payload: { projectId: string; urgencyReason: string; updatedAt: string; updatedBy: string }) => void;
  onRemoveUrgente: (project: Project) => void;
  onClearFilters?: () => void;
  state?: "loading" | "ready" | "error";
  onRetry?: () => void;
};

type SortableKey = "codigo_projeto" | "external" | "vendedor" | "construtora" | "data_lancamento";

function copyText(value: string) {
  if (typeof navigator === "undefined") return;
  navigator.clipboard.writeText(value).catch(() => undefined);
}

export function ProjectsTable({
  projects,
  onViewDetails,
  onEditProject,
  onChangeStatus,
  onViewHistory,
  onMarkUrgente,
  onRemoveUrgente,
  onClearFilters,
  state = "ready",
  onRetry,
}: ProjectsTableProps) {
  const [sortKey, setSortKey] = useState<SortableKey>("codigo_projeto");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [urgencyDialogProject, setUrgencyDialogProject] = useState<Project | undefined>(undefined);
  const [removeUrgencyProject, setRemoveUrgencyProject] = useState<Project | undefined>(undefined);

  const sortedProjects = useMemo(() => {
    const copy = [...projects];
    copy.sort((a, b) => {
      const getValue = (project: Project) => {
        if (sortKey === "external") return project.codigo_projeto;
        if (sortKey === "construtora") return `${project.construtora} ${project.obra}`;
        return String(project[sortKey]);
      };

      const av = getValue(a).toLowerCase();
      const bv = getValue(b).toLowerCase();
      const result = av.localeCompare(bv);
      return sortDir === "asc" ? result : -result;
    });
    return copy;
  }, [projects, sortDir, sortKey]);

  const total = sortedProjects.length;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageRows = sortedProjects.slice(start, end);

  const sortableHeaders: Array<{ key: SortableKey; label: string }> = [
    { key: "codigo_projeto", label: "CODIGO" },
    { key: "construtora", label: "CONSTRUTORA / OBRA" },
    { key: "vendedor", label: "VENDEDOR" },
    { key: "external", label: "STATUS" },
    { key: "data_lancamento", label: "PRAZO" },
  ];

  function toggleSort(next: SortableKey) {
    if (next === sortKey) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(next);
    setSortDir("asc");
  }

  if (state === "loading") {
    return (
      <div className="grid gap-2 rounded-3xl border border-line bg-white dark:bg-panel p-4 shadow-[0_16px_30px_-24px_rgba(0,0,0,0.4)]">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-foreground">
          <LoaderCircle size={16} className="animate-spin" />
          Carregando pipeline...
        </p>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-white/8" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-red-700">
          <AlertTriangle size={16} />
          Nao foi possivel carregar os projetos.
        </p>
        <p className="mt-1 text-sm text-red-600">Tente novamente em alguns instantes.</p>
        <div className="mt-3">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-700/50 bg-white dark:bg-panel px-3 py-2 text-sm font-semibold text-red-700 dark:text-red-300"
          >
            <RotateCcw size={14} />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-zinc-300 dark:border-white/15 bg-white dark:bg-panel p-10 text-center text-sm text-zinc-500 dark:text-muted">
        <p className="font-semibold text-zinc-700 dark:text-foreground">Nenhum projeto corresponde aos filtros aplicados.</p>
        <p className="mt-1">Ajuste os filtros ou crie um novo projeto.</p>
        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-3 rounded-lg border border-line bg-white dark:bg-panel-soft px-3 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300"
          >
            Limpar filtros
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto lg:overflow-visible rounded-3xl border border-line bg-white dark:bg-panel shadow-[0_18px_32px_-28px_rgba(0,0,0,0.6)]">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col style={{ width: "170px" }} />
            <col style={{ width: "auto" }} />
            <col style={{ width: "130px" }} />
            <col style={{ width: "170px" }} />
            <col style={{ width: "120px" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "190px" }} />
            <col style={{ width: "60px" }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-zinc-100/90 dark:bg-zinc-800/90 text-left text-xs tracking-wide text-zinc-600 dark:text-zinc-400 uppercase backdrop-blur-sm">
            <tr>
              {sortableHeaders.map((header) => (
                <th key={header.key} className="px-3 py-2.5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => toggleSort(header.key)}
                    className="inline-flex items-center gap-1 font-semibold text-zinc-600 dark:text-zinc-400 transition hover:text-zinc-900 dark:hover:text-zinc-200"
                  >
                    {header.label}
                    <ArrowDownWideNarrow size={13} className={sortKey === header.key ? "text-brand" : "text-zinc-400 dark:text-zinc-600"} />
                  </button>
                </th>
              ))}
              <th className="px-3 py-2.5 whitespace-nowrap">PRIORIDADE</th>
              <th className="px-3 py-2.5 whitespace-nowrap">PROXIMA ACAO</th>
              <th className="px-3 py-2.5 text-right whitespace-nowrap">ACOES</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((project, index) => (
              <tr
                key={project.id}
                className={`group cursor-pointer border-t border-zinc-100 dark:border-white/5 transition hover:bg-zinc-50 dark:hover:bg-white/5 ${project.urgente ? "bg-red-50/40 dark:bg-red-900/10" : index % 2 === 0 ? "bg-white dark:bg-panel" : "bg-zinc-50/35 dark:bg-white/[0.02]"}`}
                onClick={() => onViewDetails(project)}
              >
                <td className="relative px-3 py-3 font-semibold text-zinc-900 dark:text-foreground whitespace-nowrap">
                  {project.urgente && <span className="absolute top-0 left-0 h-full w-[3px] rounded-r-full bg-[#9e0b0f]" />}
                  <div title={project.codigo_projeto} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft px-2 py-1 font-mono text-xs">
                    <span className="shrink-0">{project.codigo_projeto}</span>
                    <button
                      type="button"
                      title="Copiar codigo"
                      onClick={(event) => {
                        event.stopPropagation();
                        copyText(project.codigo_projeto);
                      }}
                      className="rounded p-1 text-zinc-500 dark:text-zinc-500 transition hover:bg-white dark:hover:bg-white/10 hover:text-zinc-900 dark:hover:text-zinc-200"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-3 overflow-hidden">
                  <div title={project.construtora} className="truncate font-semibold text-zinc-800 dark:text-foreground">{project.construtora}</div>
                  <div title={project.obra} className="truncate text-xs text-zinc-500 dark:text-muted">{project.obra}</div>
                </td>
                <td title={project.vendedor} className="px-3 py-3 text-zinc-700 dark:text-zinc-300 whitespace-nowrap truncate">{project.vendedor}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <StatusBadge status={project.status_atual} />
                </td>
                <td className="px-3 py-3 text-left whitespace-nowrap">
                  <DeadlineBadge project={project} />
                </td>
                <td className="px-3 py-3 text-left whitespace-nowrap">
                  {project.urgente ? (
                    <UrgenteBadge urgente={true} />
                  ) : (
                    <span className="inline-flex h-7 items-center rounded-full border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft px-2.5 text-[11px] font-semibold tracking-wide text-zinc-600 dark:text-zinc-400 whitespace-nowrap">Normal</span>
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <span title={computeNextAction(project)} className="inline-flex h-7 max-w-[180px] items-center rounded-full border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft px-2.5 text-[11px] font-semibold tracking-wide text-zinc-700 dark:text-zinc-300 whitespace-nowrap overflow-hidden text-ellipsis">
                    {computeNextAction(project)}
                  </span>
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button
                          type="button"
                          aria-label="Abrir acoes do projeto"
                          onClick={(event) => event.stopPropagation()}
                          className="rounded-lg border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel-soft p-1.5 text-zinc-600 dark:text-zinc-400 transition hover:text-zinc-900 dark:hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
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
                              onSelect={() => onEditProject(project)}
                              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-300 outline-none hover:bg-zinc-100 dark:hover:bg-white/8"
                            >
                              <PencilLine size={14} className="text-zinc-500 dark:text-zinc-500" />
                              Editar projeto
                            </DropdownMenu.Item>
                          </DropdownMenu.Group>
                          <DropdownMenu.Separator className="my-1 h-px bg-zinc-100 dark:bg-white/8" />
                          <DropdownMenu.Group>
                            <DropdownMenu.Item
                              disabled={project.status_atual === "PROJETO FINAL ENVIADO"}
                              onSelect={() => onChangeStatus(project)}
                              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-800 dark:text-zinc-300 outline-none hover:bg-zinc-100 dark:hover:bg-white/8 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                            >
                              <Workflow size={14} className="text-zinc-500 dark:text-zinc-500" />
                              Alterar status
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              disabled={project.status_atual === "PROJETO FINAL ENVIADO"}
                              onSelect={() => {
                                if (project.urgente) {
                                  setRemoveUrgencyProject(project);
                                  return;
                                }
                                setUrgencyDialogProject(project);
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 dark:border-white/8 px-3 py-3 text-sm">
          <p className="text-zinc-600 dark:text-zinc-400">Exibindo {start + 1}-{end} de {total} registros</p>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
              Itens por pagina
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-line bg-white dark:bg-panel-soft px-2 dark:text-foreground"
              >
                {[10, 20, 30].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={safePage <= 1}
              className="rounded-lg border border-line bg-white dark:bg-panel-soft p-2 text-zinc-700 dark:text-zinc-400 disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="min-w-12 text-center text-zinc-700 dark:text-zinc-400">{safePage}/{totalPages}</span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
              disabled={safePage >= totalPages}
              className="rounded-lg border border-line bg-white dark:bg-panel-soft p-2 text-zinc-700 dark:text-zinc-400 disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      <UrgencyJustificationDialog
        open={Boolean(urgencyDialogProject)}
        project={urgencyDialogProject}
        onCancel={() => setUrgencyDialogProject(undefined)}
        onConfirm={(payload) => {
          onMarkUrgente(payload);
          setUrgencyDialogProject(undefined);
        }}
      />

      <RemoveUrgencyConfirmDialog
        open={Boolean(removeUrgencyProject)}
        project={removeUrgencyProject}
        onCancel={() => setRemoveUrgencyProject(undefined)}
        onConfirm={() => {
          if (removeUrgencyProject) onRemoveUrgente(removeUrgencyProject);
          setRemoveUrgencyProject(undefined);
        }}
      />
    </>
  );
}
