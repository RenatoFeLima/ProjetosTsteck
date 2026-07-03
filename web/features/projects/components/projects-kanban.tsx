"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ArrowDownUp, BellPlus, Check, CheckCircle2, ChevronDown, GripVertical } from "lucide-react";
import type { Project, ProjectStatus } from "@/features/projects/domain/project-types";
import {
  computeNextAction,
  getCurrentStatusDeadline,
  sortProjectsForKanban,
  sortProjectsByCodeDesc,
  CODE_DESC_SORTED_COLUMNS,
  validateStatusTransition,
  DEFAULT_KANBAN_SORT_MODE,
  type KanbanSortMode,
} from "@/features/projects/domain/project-rules";
import { getStatusTheme } from "@/features/projects/domain/status-theme";
import { PrazoBadge, UrgenteBadge, formatUrgentDeadline } from "./pill-badges";
import { KanbanStatusChangeDialog } from "./kanban-status-change-dialog";
import { FinalCodeDialog } from "./final-code-dialog";
import { ReminderPill } from "./reminder-badges";
import { activeRemindersForProject } from "@/features/projects/domain/project-reminders";
import { useProjectsStore } from "@/features/projects/state/projects-store";

/** Cadastro Inicial com documentação + local da cabine recebidos → pronto p/ alinhamento. */
function isReadyForAlignment(project: Project): boolean {
  return (
    project.status_atual === "CADASTRO INICIAL" &&
    Boolean(project.proj_obra_recebido) &&
    Boolean(project.local_cabine_definido)
  );
}

const COLUMNS: ProjectStatus[] = [
  "CADASTRO INICIAL",
  "ELABORAR ANTE-PROJETO",
  "ANTE-PROJETO ENVIADO",
  "ANTE-PROJETO APROVADO",
  "PROJETO FINAL ENVIADO",
  "PROJETO APROVADO",
  "REVISAO DE ESTUDO",
  "REVISAO DE PROJETO FINAL",
];

// Colunas que exibem o controle de ordenação. Foco inicial em ELABORAR
// ANTE-PROJETO; preparado para ampliar sem quebrar (a coluna terminal PROJETO
// APROVADO mantém sua própria ordem fixa e não recebe o controle).
const SORTABLE_COLUMNS: ProjectStatus[] = ["ELABORAR ANTE-PROJETO"];

const SORT_MODE_STORAGE_KEY = "tsteck:kanban:sortModes";
const SORT_MODE_VALUES: KanbanSortMode[] = ["deadline", "oldest", "newest"];

/** Lê os modos de ordenação persistidos (por status) do localStorage. Seguro em
 *  SSR/erros: retorna {} se indisponível. */
function readPersistedSortModes(): Partial<Record<ProjectStatus, KanbanSortMode>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SORT_MODE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Partial<Record<ProjectStatus, KanbanSortMode>> = {};
    for (const [status, mode] of Object.entries(parsed)) {
      if (SORT_MODE_VALUES.includes(mode as KanbanSortMode)) {
        result[status as ProjectStatus] = mode as KanbanSortMode;
      }
    }
    return result;
  } catch {
    return {};
  }
}

const COLUMN_VIEWPORT_HEIGHT = 520;
const CARD_HEIGHT = 120;
const CARD_GAP = 8;
const ROW_SIZE = CARD_HEIGHT + CARD_GAP;
const OVERSCAN = 5;

type PendingMove = {
  projectId: string;
  projectCode: string;
  construtora?: string;
  obra?: string;
  fromStatus: ProjectStatus;
  nextStatus: ProjectStatus;
};

type ProjectsKanbanProps = {
  projects: Project[];
  onMoveStatus: (
    projectId: string,
    nextStatus: ProjectStatus,
    observation?: string,
    finalCode?: string,
  ) => { ok: boolean; error?: string };
  onOpen: (project: Project) => void;
  notify: (message: string) => void;
  /** Verifica duplicidade do código (usado no modal de código final). */
  isCodigoDuplicado: (codigo: string, ignoreId?: string) => boolean;
  /** Quando false, o arraste é desabilitado (usuário sem permissão kanban.dragAndDrop). */
  canDrag?: boolean;
  /** Abre o modal de criação de lembrete (presente só para ADMIN/Projetos). */
  onCreateReminder?: (project: Project) => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getReviewOrdinal(count: number): string {
  const ordinals = ["1ª", "2ª", "3ª", "4ª", "5ª", "6ª", "7ª", "8ª", "9ª", "10ª"];
  return ordinals[count - 1] ?? `${count}ª`;
}

// ─── Shared card content ─────────────────────────────────────────────────────

function CardContent({
  project,
  onCreateReminder,
}: {
  project: Project;
  /** Presente somente para quem pode gerenciar lembretes — mostra o botão de pin. */
  onCreateReminder?: (project: Project) => void;
}) {
  const theme = getStatusTheme(project.status_atual);
  const nextAction = computeNextAction(project);
  const isInReview = project.status_atual === "REVISAO DE ESTUDO";
  const isInFinalReview = project.status_atual === "REVISAO DE PROJETO FINAL";
  const accentBg = project.urgente ? "bg-[#9e0b0f] dark:bg-red-600" : theme.accentBg;

  // Lembretes ativos do projeto (indicador discreto — NÃO pinta o card inteiro
  // nem interfere em urgência/status/SLA/ordenação). Mostra o mais crítico + "+N".
  const reminders = useProjectsStore((s) => s.reminders);
  const activeReminders = activeRemindersForProject(reminders, project.id);
  const topReminder = activeReminders[0] ?? null;

  return (
    <div className="flex">
      {/* Left accent strip */}
      <div className={`w-[3px] flex-none ${accentBg} transition-colors`} />

      {/* Card body */}
      <div className="flex-1 min-w-0 p-3">
        {/* Row 1: grip handle + project code + urgente badge + pin de lembrete */}
        <div className="mb-0.5 flex items-start gap-1.5">
          <GripVertical size={13} className="mt-[2px] shrink-0 text-zinc-300 dark:text-zinc-600" />
          <span className="flex-1 min-w-0 font-mono text-[12.5px] font-bold leading-tight text-zinc-900 dark:text-foreground">
            {project.codigo_projeto}
          </span>
          {onCreateReminder && (
            <button
              type="button"
              aria-label={`Criar lembrete para ${project.codigo_projeto}`}
              title="Criar lembrete para esta obra"
              // stopPropagation no pointerdown impede o dnd-kit de iniciar o arraste.
              onPointerDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onCreateReminder(project);
              }}
              className="shrink-0 rounded-md p-0.5 text-zinc-300 transition hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-600 dark:hover:bg-white/8 dark:hover:text-zinc-300"
            >
              <BellPlus size={13} />
            </button>
          )}
          {project.urgente && <UrgenteBadge urgente urgentDeadline={project.urgentDeadline} />}
        </div>

        {/* Row 2: construtora */}
        <p className="pl-[19px] text-[12px] font-semibold leading-snug text-zinc-800 dark:text-zinc-200">
          {project.construtora}
        </p>

        {/* Row 3: obra */}
        <p className="pl-[19px] mt-0.5 truncate text-[11px] leading-snug text-zinc-500 dark:text-muted" title={project.obra}>
          {project.obra}
        </p>

        {/* Row 3b: prazo de urgência (data discreta, só para projetos urgentes com deadline) */}
        {project.urgente && project.urgentDeadline && (
          <p className="pl-[19px] mt-0.5 text-right text-[10px] leading-snug text-red-500 dark:text-red-400">
            {formatUrgentDeadline(project.urgentDeadline)}
          </p>
        )}

        {/* Row 4: deadline badge + review badges */}
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {isReadyForAlignment(project) && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/30 dark:text-emerald-300">
              <CheckCircle2 size={11} />
              Pronto para alinhamento
            </span>
          )}
          <PrazoBadge project={project} />
          {topReminder && (
            <ReminderPill reminder={topReminder} extraCount={activeReminders.length - 1} />
          )}
          {project.reviewCount > 0 && (
            <span
              title={`Passou ${project.reviewCount}x por Revisao de Estudo`}
              className={[
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                isInReview
                  ? "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-700/50 dark:bg-orange-900/30 dark:text-orange-300"
                  : "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700/40 dark:bg-zinc-800/40 dark:text-zinc-400",
              ].join(" ")}
            >
              {isInReview
                ? `${getReviewOrdinal(project.reviewCount)} rev. estudo`
                : `${project.reviewCount}x rev. estudo`}
            </span>
          )}
          {project.finalReviewCount > 0 && (
            <span
              title={`Passou ${project.finalReviewCount}x por Revisao de Projeto Final`}
              className={[
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                isInFinalReview
                  ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-700/50 dark:bg-rose-900/30 dark:text-rose-300"
                  : "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700/40 dark:bg-zinc-800/40 dark:text-zinc-400",
              ].join(" ")}
            >
              {isInFinalReview
                ? `${getReviewOrdinal(project.finalReviewCount)} rev. final`
                : `${project.finalReviewCount}x rev. final`}
            </span>
          )}
        </div>

        {/* Row 5: next action */}
        <p
          title={nextAction}
          className="mt-2 truncate rounded border border-zinc-100 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.03] px-2 py-1 text-[10.5px] text-zinc-500 dark:text-zinc-400"
        >
          {nextAction}
        </p>
      </div>
    </div>
  );
}

function KanbanCard({
  project,
  onOpen,
  recentlyMoved,
  canDrag,
  onCreateReminder,
}: {
  project: Project;
  onOpen: (project: Project) => void;
  recentlyMoved: boolean;
  canDrag: boolean;
  onCreateReminder?: (project: Project) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: project.id,
    data: { projectId: project.id },
    disabled: !canDrag,
  });
  const ready = isReadyForAlignment(project);

  return (
    <article
      ref={setNodeRef}
      {...(canDrag ? listeners : {})}
      {...attributes}
      onDoubleClick={() => {
        if (!isDragging) onOpen(project);
      }}
      className={[
        "relative rounded-xl border overflow-hidden select-none",
        !canDrag
          ? "cursor-pointer transition-all duration-150 shadow-[0_1px_4px_-1px_rgba(0,0,0,0.06),0_4px_16px_-6px_rgba(0,0,0,0.10)] hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.10),0_8px_24px_-6px_rgba(0,0,0,0.16)] " + (ready ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-700/50 dark:bg-emerald-900/[0.12]" : "border-zinc-200 bg-white dark:border-white/8 dark:bg-panel-soft")
          : isDragging
          ? "cursor-grabbing border-dashed border-zinc-200 dark:border-white/8 bg-zinc-50/60 dark:bg-white/[0.03] opacity-35 shadow-none"
          : [
              "cursor-grab transition-all duration-150",
              "shadow-[0_1px_4px_-1px_rgba(0,0,0,0.06),0_4px_16px_-6px_rgba(0,0,0,0.10)]",
              "hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.10),0_8px_24px_-6px_rgba(0,0,0,0.16)]",
              "hover:-translate-y-px",
              ready
                ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-700/50 dark:bg-emerald-900/[0.12]"
                : "border-zinc-200 bg-white dark:border-white/8 dark:bg-panel-soft",
            ].join(" "),
      ].join(" ")}
      style={isDragging ? { minHeight: CARD_HEIGHT } : undefined}
    >
      <CardContent project={project} onCreateReminder={onCreateReminder} />
      {recentlyMoved && <SuccessOverlay />}
    </article>
  );
}

// ─── Overlay card — follows the mouse, rendered via DragOverlay portal ────────

function DragOverlayCard({ project, width }: { project: Project; width?: number }) {
  return (
    <article
      className="cursor-grabbing select-none rounded-xl border overflow-hidden bg-white dark:bg-panel-soft shadow-[0_16px_48px_-8px_rgba(0,0,0,0.24),0_6px_20px_-6px_rgba(0,0,0,0.16)]"
      style={{
        width: width ?? undefined,
        transform: "scale(1.03) rotate(0.6deg)",
        transformOrigin: "center top",
      }}
    >
      <CardContent project={project} />
    </article>
  );
}

// ─── Success badge shown briefly after a confirmed move ───────────────────────

function SuccessOverlay() {
  return (
    <div className="animate-[fadeScaleIn_150ms_ease-out] pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-white/80 dark:bg-panel-soft/90">
      <span className="flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-700/50 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shadow-sm">
        <CheckCircle2 size={13} />
        Status atualizado
      </span>
    </div>
  );
}

function BlockedMoveDialog({
  open,
  reasons,
  onClose,
  onEdit,
}: {
  open: boolean;
  reasons: string[];
  onClose: () => void;
  onEdit?: () => void;
}) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  if (!isMounted || !open || reasons.length === 0) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4"
    >
      <article
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="blocked-move-title"
        className="w-full max-w-[520px] animate-[fadeScaleIn_150ms_ease-out] rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-6 shadow-[0_32px_64px_-20px_rgba(0,0,0,0.35)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20 text-[#9e0b0f] dark:text-red-300">
            <AlertCircle size={18} />
          </span>
          <div>
            <h2 id="blocked-move-title" className="text-lg font-bold text-zinc-900 dark:text-foreground">
              Nao e possivel mover este projeto
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Conclua as pendencias abaixo antes de alterar o status.
            </p>
          </div>
        </header>
        <ul className="rounded-xl border border-red-100 dark:border-red-700/30 bg-red-50/50 dark:bg-red-900/15 p-3 space-y-2">
          {reasons.map((reason, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#9e0b0f]/60" />
              {reason}
            </li>
          ))}
        </ul>
        <footer className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel-soft px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Entendi
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-xl bg-[#9e0b0f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7f090c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e0b0f]/50"
            >
              Editar projeto
            </button>
          )}
        </footer>
      </article>
    </div>,
    document.body,
  );
}

function getBlockReasons(project: Project, toStatus: ProjectStatus): string[] {
  const validation = validateStatusTransition(project, toStatus);
  if (validation.allowed) return [];

  const reasons: string[] = [];
  if (validation.reason) reasons.push(validation.reason);
  if (validation.missingFields && validation.missingFields.length > 0) {
    reasons.push(...validation.missingFields.map((f) => `• ${f}`));
  }
  return reasons;
}

// ─── Virtual scroll helper ────────────────────────────────────────────────────

function useVirtualSlice(total: number, scrollTop: number) {
  const visibleCount = Math.ceil(COLUMN_VIEWPORT_HEIGHT / ROW_SIZE);
  const start = Math.max(Math.floor(scrollTop / ROW_SIZE) - OVERSCAN, 0);
  const end = Math.min(start + visibleCount + OVERSCAN * 2, total);
  return {
    start,
    end,
    top: start * ROW_SIZE,
    bottom: Math.max((total - end) * ROW_SIZE, 0),
  };
}

// ─── Sort control (column header) ─────────────────────────────────────────────

// Labels explícitos de que a ordenação é pela DATA DE VENCIMENTO do card (e não
// por data de cadastro), evitando a ambiguidade que o "Mais antigo primeiro" tinha.
const SORT_OPTIONS: Array<{ value: KanbanSortMode; label: string }> = [
  { value: "deadline", label: "Por vencimento" },
  { value: "oldest", label: "Vencimento: antigo → novo" },
  { value: "newest", label: "Vencimento: novo → antigo" },
];

/** Dropdown discreto de ordenação no cabeçalho da coluna. Estado é controlado
 *  pelo Board (value/onChange); este componente só lida com abrir/fechar o menu. */
function ColumnSortMenu({
  value,
  onChange,
  columnLabel,
}: {
  value: KanbanSortMode;
  onChange: (mode: KanbanSortMode) => void;
  columnLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Ordenar coluna ${columnLabel}`}
        title="Ordenar coluna"
        className="inline-flex items-center gap-1 rounded-lg border border-zinc-200/70 dark:border-white/10 bg-white/70 dark:bg-panel-soft/70 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 transition hover:text-zinc-800 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-white/20"
      >
        <ArrowDownUp size={11} />
        Ordenar
        <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-xl border border-zinc-200/70 dark:border-white/10 bg-white dark:bg-panel shadow-[0_8px_24px_-6px_rgba(0,0,0,0.18)]"
        >
          {SORT_OPTIONS.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] transition hover:bg-zinc-50 dark:hover:bg-white/5 ${
                  active ? "font-semibold text-zinc-900 dark:text-foreground" : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                <Check size={12} className={active ? "text-brand" : "opacity-0"} />
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

function KanbanColumn({
  status,
  projects,
  onOpen,
  isDragActive,
  isDropTarget,
  recentlyMovedProjectId,
  canDrag,
  sortMode,
  onSortModeChange,
  showSortControl,
  onCreateReminder,
}: {
  status: ProjectStatus;
  projects: Project[];
  onOpen: (project: Project) => void;
  isDragActive: boolean;
  isDropTarget: boolean;
  recentlyMovedProjectId: string | null;
  canDrag: boolean;
  sortMode: KanbanSortMode;
  onSortModeChange: (mode: KanbanSortMode) => void;
  /** Controla se o botão de ordenação aparece nesta coluna. */
  showSortControl: boolean;
  onCreateReminder?: (project: Project) => void;
}) {
  const { setNodeRef } = useDroppable({ id: status });
  const [scrollTop, setScrollTop] = useState(0);
  const { start, end, top, bottom } = useVirtualSlice(projects.length, scrollTop);

  const effectiveProjects = isDragActive ? projects : projects.slice(start, end);
  const effectiveTop = isDragActive ? 0 : top;
  const effectiveBottom = isDragActive ? 0 : bottom;

  const theme = getStatusTheme(status);

  const urgentCount = useMemo(() => projects.filter((p) => p.urgente).length, [projects]);
  const nearDeadlineCount = useMemo(
    () =>
      projects.filter((p) => {
        if (p.status_atual !== "ELABORAR ANTE-PROJETO") return false;
        const dl = getCurrentStatusDeadline(p);
        return dl.isOverdue || (dl.hasDeadline && (dl.daysRemaining ?? 999) <= 15);
      }).length,
    [projects],
  );

  const sectionClass = [
    "flex flex-col min-h-44 rounded-2xl border overflow-hidden transition-colors duration-150",
    isDropTarget
      ? `${theme.columnDropBg} ${theme.columnDropBorder}`
      : isDragActive
        ? "border-zinc-200/60 dark:border-white/5 bg-white/50 dark:bg-panel/60"
        : `${theme.columnBg} ${theme.columnBorder}`,
  ].join(" ");

  return (
    <section ref={setNodeRef} className={sectionClass}>
      {/* Colored top strip — status identity */}
      <div className={`h-[3px] w-full flex-none ${theme.accentBg}`} />

      {/* Column header */}
      <header className="flex-none px-3 pt-2.5 pb-2.5 border-b border-zinc-200/60 dark:border-white/[0.07]">
        <div className="flex items-start justify-between gap-2">
          <h3
            className="min-w-0 flex-1 text-[11px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400 truncate"
            title={theme.label}
          >
            {theme.label}
          </h3>
          {showSortControl && (
            <ColumnSortMenu value={sortMode} onChange={onSortModeChange} columnLabel={theme.label} />
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${theme.countPill}`}>
            {projects.length} {projects.length === 1 ? "projeto" : "projetos"}
          </span>
          {urgentCount > 0 && (
            <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-[#9e0b0f] dark:border-red-700/40 dark:bg-red-900/15 dark:text-red-300">
              {urgentCount} urg.
            </span>
          )}
          {nearDeadlineCount > 0 && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/15 dark:text-amber-300">
              {nearDeadlineCount} crít{nearDeadlineCount !== 1 ? "icos" : "ico"}
            </span>
          )}
        </div>
      </header>

      {/* Cards scroll area */}
      <div
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className="flex-1 overflow-y-auto px-3 py-3"
        style={{ maxHeight: `${COLUMN_VIEWPORT_HEIGHT}px` }}
      >
        {effectiveTop > 0 && <div style={{ height: effectiveTop }} />}
        <div className="space-y-2">
          {effectiveProjects.map((project) => (
            <KanbanCard
              key={project.id}
              project={project}
              onOpen={onOpen}
              recentlyMoved={recentlyMovedProjectId === project.id}
              canDrag={canDrag}
              onCreateReminder={onCreateReminder}
            />
          ))}
        </div>
        {effectiveBottom > 0 && <div style={{ height: effectiveBottom }} />}
      </div>
    </section>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────

export function ProjectsKanban({ projects, onMoveStatus, onOpen, notify, isCodigoDuplicado, canDrag = true, onCreateReminder }: ProjectsKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<ProjectStatus | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [finalCodeMove, setFinalCodeMove] = useState<PendingMove | null>(null);
  const [blockedMove, setBlockedMove] = useState<{ projectId: string; reasons: string[] } | null>(null);
  const [recentlyMovedProjectId, setRecentlyMovedProjectId] = useState<string | null>(null);
  // Bug #4: capture the dragged card's measured width for the overlay
  const [dragCardWidth, setDragCardWidth] = useState<number | undefined>(undefined);

  // Modo de ordenação POR coluna (estado local da tela). Inicializador preguiçoso
  // lê o localStorage (readPersistedSortModes é SSR-safe: retorna {} sem window).
  // Só afeta a exibição — nenhuma chamada a backend.
  const [sortModes, setSortModes] = useState<Partial<Record<ProjectStatus, KanbanSortMode>>>(
    () => readPersistedSortModes(),
  );

  function getSortMode(status: ProjectStatus): KanbanSortMode {
    return sortModes[status] ?? DEFAULT_KANBAN_SORT_MODE;
  }

  function handleSortModeChange(status: ProjectStatus, mode: KanbanSortMode) {
    setSortModes((prev) => {
      const next = { ...prev, [status]: mode };
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(SORT_MODE_STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* persistência é best-effort; ignora cota/privacidade */
        }
      }
      return next;
    });
  }

  const allSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );
  // Sem permissão de arraste, nenhum sensor é ativo → cards só abrem ao clicar.
  const sensors = canDrag ? allSensors : [];

  const byStatus = useMemo(
    () =>
      COLUMNS.map((status) => {
        const list = projects.filter((p) => p.status_atual === status);
        if (CODE_DESC_SORTED_COLUMNS.includes(status)) {
          // Colunas de projeto final: ordenadas pelos 4 últimos dígitos do código
          // (decrescente). Fallback estável usa a ordem por prazo já existente.
          return { status, projects: sortProjectsByCodeDesc(sortProjectsForKanban(list)) };
        }
        const mode = sortModes[status] ?? DEFAULT_KANBAN_SORT_MODE;
        return { status, projects: sortProjectsForKanban(list, mode) };
      }),
    [projects, sortModes],
  );

  const activeProject = useMemo(
    () => (activeId ? (projects.find((p) => p.id === activeId) ?? null) : null),
    [projects, activeId],
  );

  function handleDragStart(event: DragStartEvent) {
    // Bug #4: use dnd-kit's pre-measured rect (already viewport-relative, no DOM query needed)
    const initialRect = event.active.rect.current.initial;
    setDragCardWidth(initialRect?.width ?? undefined);
    setActiveId(String(event.active.id));
    setOverStatus(null);
  }

  function handleDragOver(event: DragOverEvent) {
    setOverStatus((event.over?.id as ProjectStatus) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    // Bug #3B: guard against double-fire from pointer/touch edge cases
    if (!activeId) return;

    const projectId = String(event.active.id);
    const targetStatus = event.over?.id as ProjectStatus | undefined;

    setActiveId(null);
    setOverStatus(null);
    setDragCardWidth(undefined);

    if (!targetStatus) return;

    const current = projects.find((p) => p.id === projectId);
    if (!current || current.status_atual === targetStatus) return;

    const blockReasons = getBlockReasons(current, targetStatus);
    if (blockReasons.length > 0) {
      setBlockedMove({ projectId: current.id, reasons: blockReasons });
      return;
    }

    const move: PendingMove = {
      projectId,
      projectCode: current.codigo_projeto,
      fromStatus: current.status_atual,
      nextStatus: targetStatus,
    };
    // Projeto Final Enviado: confirma/atualiza o código antes de mover.
    if (targetStatus === "PROJETO FINAL ENVIADO") {
      setFinalCodeMove(move);
      return;
    }
    setPendingMove({
      projectId,
      projectCode: current.codigo_projeto,
      construtora: current.construtora,
      obra: current.obra,
      fromStatus: current.status_atual,
      nextStatus: targetStatus,
    });
  }

  function handleDragCancel() {
    setActiveId(null);
    setOverStatus(null);
    setDragCardWidth(undefined);
  }

  function handleConfirm(observation?: string) {
    if (!pendingMove) return;

    const result = onMoveStatus(pendingMove.projectId, pendingMove.nextStatus, observation);

    if (!result.ok) {
      notify(result.error ?? "Falha ao atualizar status no Kanban.");
    } else {
      notify(`Projeto movido para ${pendingMove.nextStatus}.`);
      const movedId = pendingMove.projectId;
      setRecentlyMovedProjectId(movedId);
      setTimeout(
        () => setRecentlyMovedProjectId((cur) => (cur === movedId ? null : cur)),
        1800,
      );
    }

    setPendingMove(null);
  }

  function handleCancel() {
    setPendingMove(null);
    notify("Alteracao cancelada.");
  }

  function handleConfirmFinalCode(finalCode: string) {
    if (!finalCodeMove) return;
    const result = onMoveStatus(finalCodeMove.projectId, finalCodeMove.nextStatus, undefined, finalCode);
    if (!result.ok) {
      notify(result.error ?? "Falha ao enviar o projeto final.");
    } else {
      notify(`Projeto final enviado com o codigo ${finalCode}.`);
      const movedId = finalCodeMove.projectId;
      setRecentlyMovedProjectId(movedId);
      setTimeout(() => setRecentlyMovedProjectId((cur) => (cur === movedId ? null : cur)), 1800);
    }
    setFinalCodeMove(null);
  }

  function handleCancelFinalCode() {
    // Cancelar o modal NÃO move o card.
    setFinalCodeMove(null);
    notify("Movimentacao cancelada.");
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      // Bug #1A: getBoundingClientRect() gives viewport-relative coords, fixing the
      // overlay offset that occurs when ancestor scroll containers are present
      measuring={{
        draggable: { measure: (el) => el.getBoundingClientRect() },
        droppable: { strategy: MeasuringStrategy.Always },
        dragOverlay: { measure: (el) => el.getBoundingClientRect() },
      }}
      // Bug #7: screen reader announcements for WCAG compliance
      accessibility={{
        announcements: {
          onDragStart: ({ active }) =>
            `Iniciando arraste do projeto ${active.id}.`,
          onDragOver: ({ active, over }) =>
            over
              ? `Projeto ${active.id} sobre a coluna ${String(over.id)}.`
              : `Projeto ${active.id} fora de qualquer coluna.`,
          onDragEnd: ({ active, over }) =>
            over
              ? `Projeto ${active.id} solto na coluna ${String(over.id)}.`
              : `Projeto ${active.id} retornou a posicao original.`,
          onDragCancel: ({ active }) =>
            `Arraste do projeto ${active.id} cancelado.`,
        },
      }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {byStatus.map((column) => (
          <KanbanColumn
            key={column.status}
            status={column.status}
            projects={column.projects}
            onOpen={onOpen}
            isDragActive={activeId !== null}
            isDropTarget={overStatus === column.status && activeId !== null}
            recentlyMovedProjectId={recentlyMovedProjectId}
            canDrag={canDrag}
            sortMode={getSortMode(column.status)}
            onSortModeChange={(mode) => handleSortModeChange(column.status, mode)}
            showSortControl={SORTABLE_COLUMNS.includes(column.status)}
            onCreateReminder={onCreateReminder}
          />
        ))}
      </div>

      {/* dropAnimation=null: overlay disappears instantly on drop, card returns cleanly */}
      <DragOverlay dropAnimation={null}>
        {activeProject ? (
          <DragOverlayCard project={activeProject} width={dragCardWidth} />
        ) : null}
      </DragOverlay>

      <KanbanStatusChangeDialog
        open={Boolean(pendingMove)}
        projectCode={pendingMove?.projectCode}
        construtora={pendingMove?.construtora}
        obra={pendingMove?.obra}
        fromStatus={pendingMove?.fromStatus}
        toStatus={pendingMove?.nextStatus}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
      />
      <FinalCodeDialog
        open={Boolean(finalCodeMove)}
        currentCode={finalCodeMove?.projectCode}
        ignoreId={finalCodeMove?.projectId}
        isCodigoDuplicado={isCodigoDuplicado}
        onConfirm={handleConfirmFinalCode}
        onCancel={handleCancelFinalCode}
      />
      <BlockedMoveDialog
        open={Boolean(blockedMove)}
        reasons={blockedMove?.reasons ?? []}
        onClose={() => setBlockedMove(null)}
        onEdit={
          blockedMove
            ? () => {
                const p = projects.find((proj) => proj.id === blockedMove.projectId);
                setBlockedMove(null);
                if (p) onOpen(p);
              }
            : undefined
        }
      />
    </DndContext>
  );
}
