import type { Project } from "@/features/projects/domain/project-types";
import { useMemo, useState } from "react";
import { computeNextAction, getCodeSortableSuffix } from "@/features/projects/domain/project-rules";
import { AlertTriangle, ArrowDownWideNarrow, ChevronLeft, ChevronRight, Copy, RotateCcw } from "lucide-react";
import { useViewportMode } from "@/features/sidebar/hooks/use-viewport-mode";
import { Skeleton } from "@/features/ui/skeleton";
import { DeadlineBadge, StatusBadge, UrgenteBadge } from "./pill-badges";
import { ProjectActionsMenu } from "./project-actions-menu";
import { ProjectCard, ProjectCardSkeleton } from "./project-card";
import { RemoveUrgencyConfirmDialog } from "./remove-urgency-confirm-dialog";

type ProjectsTableProps = {
  projects: Project[];
  onViewDetails: (project: Project) => void;
  onEditProject?: (project: Project) => void;
  onChangeStatus?: (project: Project) => void;
  onViewHistory: (project: Project) => void;
  onMarkUrgente?: (project: Project) => void;
  onRemoveUrgente: (project: Project) => void;
  onClearFilters?: () => void;
  state?: "loading" | "ready" | "error";
  onRetry?: () => void;
};

type SortableKey = "codigo_projeto" | "external" | "vendedor" | "construtora" | "data_lancamento";

// ─── Colunas por espaço disponível (container query) ─────────────────────────
// As 7 colunas fixas somam 950px; "Construtora / Obra" (auto) fica com o resto.
// Os limiares medem o espaço REAL da tabela (muda com a sidebar aberta/colapsada),
// garantindo ≥ ~180px para Construtora / Obra:
//   ≥ 1130px → todas as colunas (desktop, idêntico ao anterior)
//   ≥  940px → oculta Próxima ação
//   <  940px → oculta também Vendedor e Prioridade (dados seguem no drawer)
//   <  700px → mesma grade, com rolagem horizontal DENTRO da tabela
const SECONDARY_COL = "hidden @min-[940px]:table-column";
const SECONDARY_CELL = "hidden @min-[940px]:table-cell";
const TERTIARY_COL = "hidden @min-[1130px]:table-column";
const TERTIARY_CELL = "hidden @min-[1130px]:table-cell";

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
  const [removeUrgencyProject, setRemoveUrgencyProject] = useState<Project | undefined>(undefined);
  // < 768px: cards; ≥ 768px: tabela. Uma apresentação por vez, a partir dos
  // MESMOS pageRows — ordenação/paginação continuam só neste componente, então
  // trocar de faixa não reordena, não reinicia a página e não busca dados.
  const isMobile = useViewportMode() === "mobile";

  const sortedProjects = useMemo(() => {
    const copy = [...projects];
    copy.sort((a, b) => {
      if (sortKey === "codigo_projeto") {
        const as = getCodeSortableSuffix(a.codigo_projeto);
        const bs = getCodeSortableSuffix(b.codigo_projeto);
        if (typeof as === "number" && typeof bs === "number") {
          return sortDir === "asc" ? as - bs : bs - as;
        }
        const cmp = String(as).localeCompare(String(bs), undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      }

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

  const sortableHeaders: Array<{ key: SortableKey; label: string; tooltip?: string; className?: string }> = [
    { key: "codigo_projeto", label: "CODIGO", tooltip: "Ordenar pelos últimos dígitos do código." },
    { key: "construtora", label: "CONSTRUTORA / OBRA" },
    { key: "vendedor", label: "VENDEDOR", className: SECONDARY_CELL },
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

  if (state === "loading" && isMobile) {
    return (
      <div role="status" aria-busy="true" className="grid gap-3">
        <span className="sr-only">Carregando projetos...</span>
        {Array.from({ length: 4 }).map((_, index) => (
          <ProjectCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (state === "loading") {
    // Skeleton no formato da tabela: faixa do cabeçalho + linhas. Nada de
    // "0 projetos"/"Nenhum projeto" antes da consulta terminar.
    return (
      <div
        role="status"
        aria-busy="true"
        className="overflow-hidden rounded-3xl border border-line bg-white dark:bg-panel shadow-[0_18px_32px_-28px_rgba(0,0,0,0.6)]"
      >
        <span className="sr-only">Carregando projetos...</span>
        <div className="flex h-10 items-center gap-4 bg-zinc-100/90 dark:bg-zinc-800/90 px-3">
          <Skeleton className="h-3 w-20 bg-zinc-200 dark:bg-white/10" />
          <Skeleton className="h-3 w-32 bg-zinc-200 dark:bg-white/10" />
          <Skeleton className="ml-auto h-3 w-16 bg-zinc-200 dark:bg-white/10" />
        </div>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 border-t border-zinc-100 dark:border-white/5 px-3 py-3">
            <Skeleton className="h-7 w-28 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-7 w-24 shrink-0 rounded-full" />
          </div>
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

  const actionHandlers = { onViewDetails, onEditProject, onChangeStatus, onMarkUrgente, onViewHistory };
  const removeUrgencyDialog = (
    <RemoveUrgencyConfirmDialog
      open={Boolean(removeUrgencyProject)}
      project={removeUrgencyProject}
      onCancel={() => setRemoveUrgencyProject(undefined)}
      onConfirm={() => {
        if (removeUrgencyProject) onRemoveUrgente(removeUrgencyProject);
        setRemoveUrgencyProject(undefined);
      }}
    />
  );
  // Mesmo rodapé (mesma página, pageSize e total) para tabela e cards.
  const renderPagination = (className?: string) => (
    <ProjectsPagination
      className={className}
      start={start}
      end={end}
      total={total}
      pageSize={pageSize}
      page={safePage}
      totalPages={totalPages}
      onPageSizeChange={(size) => {
        setPageSize(size);
        setPage(1);
      }}
      onPrevious={() => setPage((current) => Math.max(current - 1, 1))}
      onNext={() => setPage((current) => Math.min(current + 1, totalPages))}
    />
  );

  if (isMobile) {
    return (
      <>
        {/* grid-cols-1 = minmax(0, 1fr): sem ele a coluna cresce até o texto
            sem quebra (ex.: obra longa com truncate) e a página ganha overflow. */}
        <ul aria-label="Projetos" className="grid grid-cols-1 gap-3">
          {pageRows.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} {...actionHandlers} onRequestRemoveUrgency={setRemoveUrgencyProject} />
            </li>
          ))}
        </ul>
        <div className="mt-3 rounded-2xl border border-line bg-white dark:bg-panel">{renderPagination()}</div>
        {removeUrgencyDialog}
      </>
    );
  }

  return (
    <>
      <div className="@container">
      {/* Rolagem horizontal confinada à tabela. Com todas as colunas visíveis
          (desktop) mantém overflow-visible, preservando o thead sticky na página. */}
      <div className="overflow-x-auto @min-[1130px]:overflow-visible rounded-3xl border border-line bg-white dark:bg-panel shadow-[0_18px_32px_-28px_rgba(0,0,0,0.6)]">
        <table className="w-full min-w-[700px] table-fixed text-sm">
          <colgroup>
            <col style={{ width: "170px" }} />
            <col style={{ width: "auto" }} />
            <col className={SECONDARY_COL} style={{ width: "130px" }} />
            <col style={{ width: "170px" }} />
            <col style={{ width: "120px" }} />
            <col className={SECONDARY_COL} style={{ width: "110px" }} />
            <col className={TERTIARY_COL} style={{ width: "190px" }} />
            <col style={{ width: "60px" }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-zinc-100/90 dark:bg-zinc-800/90 text-left text-xs tracking-wide text-zinc-600 dark:text-zinc-400 uppercase backdrop-blur-sm">
            <tr>
              {sortableHeaders.map((header) => (
                <th key={header.key} className={`px-3 py-2.5 whitespace-nowrap ${header.className ?? ""}`}>
                  <button
                    type="button"
                    title={header.tooltip}
                    onClick={() => toggleSort(header.key)}
                    className="inline-flex items-center gap-1 font-semibold text-zinc-600 dark:text-zinc-400 transition hover:text-zinc-900 dark:hover:text-zinc-200"
                  >
                    {header.label}
                    <ArrowDownWideNarrow size={13} className={sortKey === header.key ? "text-brand" : "text-zinc-400 dark:text-zinc-600"} />
                  </button>
                </th>
              ))}
              <th className={`px-3 py-2.5 whitespace-nowrap ${SECONDARY_CELL}`}>PRIORIDADE</th>
              <th className={`px-3 py-2.5 whitespace-nowrap ${TERTIARY_CELL}`}>PROXIMA ACAO</th>
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
                  <div
                    title={project.unidade_obra ? `${project.obra} · ${project.unidade_obra}` : project.obra}
                    className="truncate text-xs text-zinc-500 dark:text-muted"
                  >
                    {project.obra}
                    {project.unidade_obra && (
                      <span className="text-zinc-400 dark:text-zinc-500"> · {project.unidade_obra}</span>
                    )}
                  </div>
                </td>
                <td title={project.vendedor} className={`px-3 py-3 text-zinc-700 dark:text-zinc-300 whitespace-nowrap truncate ${SECONDARY_CELL}`}>{project.vendedor}</td>
                {/* [&>span]:max-w-full mantém o badge dentro da coluna (trunca com reticências). */}
                <td className="px-3 py-3 whitespace-nowrap [&>span]:max-w-full">
                  <StatusBadge status={project.status_atual} />
                </td>
                <td className="px-3 py-3 text-left whitespace-nowrap">
                  <DeadlineBadge project={project} />
                </td>
                <td className={`px-3 py-3 text-left whitespace-nowrap ${SECONDARY_CELL}`}>
                  {project.urgente ? (
                    <UrgenteBadge urgente={true} urgentDeadline={project.urgentDeadline} />
                  ) : (
                    <span className="inline-flex h-7 items-center rounded-full border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft px-2.5 text-[11px] font-semibold tracking-wide text-zinc-600 dark:text-zinc-400 whitespace-nowrap">Normal</span>
                  )}
                </td>
                <td className={`px-3 py-3 whitespace-nowrap ${TERTIARY_CELL}`}>
                  <span title={computeNextAction(project)} className="inline-flex h-7 max-w-[180px] items-center rounded-full border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft px-2.5 text-[11px] font-semibold tracking-wide text-zinc-700 dark:text-zinc-300 whitespace-nowrap overflow-hidden text-ellipsis">
                    {computeNextAction(project)}
                  </span>
                </td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                    <ProjectActionsMenu project={project} {...actionHandlers} onRequestRemoveUrgency={setRemoveUrgencyProject} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {renderPagination("border-t border-zinc-100 dark:border-white/8")}
      </div>
      </div>

      {removeUrgencyDialog}
    </>
  );
}

type ProjectsPaginationProps = {
  start: number;
  end: number;
  total: number;
  pageSize: number;
  page: number;
  totalPages: number;
  onPageSizeChange: (size: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
};

/**
 * Rodapé de paginação compartilhado por tabela e cards (estado único na
 * ProjectsTable). Com toque (pointer-coarse), alvos de 44px; com mouse, a
 * densidade é a mesma de antes.
 */
function ProjectsPagination({
  start,
  end,
  total,
  pageSize,
  page,
  totalPages,
  onPageSizeChange,
  onPrevious,
  onNext,
  className,
}: ProjectsPaginationProps) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm ${className ?? ""}`}>
      <p className="text-zinc-600 dark:text-zinc-400">Exibindo {start + 1}-{end} de {total} registros</p>
      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
          Itens por pagina
          <select
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
            className="h-9 rounded-lg border border-line bg-white dark:bg-panel-soft px-2 dark:text-foreground pointer-coarse:h-11"
          >
            {[10, 20, 30].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          aria-label="Pagina anterior"
          onClick={onPrevious}
          disabled={page <= 1}
          className="inline-flex items-center justify-center rounded-lg border border-line bg-white dark:bg-panel-soft p-2 text-zinc-700 dark:text-zinc-400 disabled:opacity-40 pointer-coarse:h-11 pointer-coarse:w-11"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="min-w-12 text-center text-zinc-700 dark:text-zinc-400">{page}/{totalPages}</span>
        <button
          type="button"
          aria-label="Proxima pagina"
          onClick={onNext}
          disabled={page >= totalPages}
          className="inline-flex items-center justify-center rounded-lg border border-line bg-white dark:bg-panel-soft p-2 text-zinc-700 dark:text-zinc-400 disabled:opacity-40 pointer-coarse:h-11 pointer-coarse:w-11"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
