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
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, GripVertical } from "lucide-react";
import type { Project, ProjectStatus } from "@/features/projects/domain/project-types";
import {
  computeNextAction,
  getCurrentStatusDeadline,
  validateStatusTransition,
} from "@/features/projects/domain/project-rules";
import { getStatusTheme } from "@/features/projects/domain/status-theme";
import { PrazoBadge, UrgenteBadge } from "./pill-badges";
import { KanbanStatusChangeDialog } from "./kanban-status-change-dialog";

const COLUMNS: ProjectStatus[] = [
  "CADASTRO INICIAL",
  "ELABORAR ANTE-PROJETO",
  "ANTE-PROJETO ENVIADO",
  "ANTE-PROJETO APROVADO",
  "PROJETO APROVADO",
  "PROJETO FINAL ENVIADO",
  "REVISAO DE ESTUDO",
  "REVISAO DE PROJETO FINAL",
];

const COLUMN_VIEWPORT_HEIGHT = 520;
const CARD_HEIGHT = 120;
const CARD_GAP = 8;
const ROW_SIZE = CARD_HEIGHT + CARD_GAP;
const OVERSCAN = 5;

type PendingMove = {
  projectId: string;
  projectCode: string;
  fromStatus: ProjectStatus;
  nextStatus: ProjectStatus;
};

type ProjectsKanbanProps = {
  projects: Project[];
  onMoveStatus: (
    projectId: string,
    nextStatus: ProjectStatus,
    observation?: string,
  ) => { ok: boolean; error?: string };
  onOpen: (project: Project) => void;
  notify: (message: string) => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getReviewOrdinal(count: number): string {
  const ordinals = ["1ª", "2ª", "3ª", "4ª", "5ª", "6ª", "7ª", "8ª", "9ª", "10ª"];
  return ordinals[count - 1] ?? `${count}ª`;
}

// ─── Shared card content ─────────────────────────────────────────────────────

function CardContent({ project }: { project: Project }) {
  const theme = getStatusTheme(project.status_atual);
  const nextAction = computeNextAction(project);
  const isInReview = project.status_atual === "REVISAO DE ESTUDO";
  const isInFinalReview = project.status_atual === "REVISAO DE PROJETO FINAL";
  const accentBg = project.urgente ? "bg-[#9e0b0f] dark:bg-red-600" : theme.accentBg;

  return (
    <div className="flex">
      {/* Left accent strip */}
      <div className={`w-[3px] flex-none ${accentBg} transition-colors`} />

      {/* Card body */}
      <div className="flex-1 min-w-0 p-3">
        {/* Row 1: grip handle + project code + urgente badge */}
        <div className="mb-0.5 flex items-start gap-1.5">
          <GripVertical size={13} className="mt-[2px] shrink-0 text-zinc-300 dark:text-zinc-600" />
          <span className="flex-1 min-w-0 font-mono text-[12.5px] font-bold leading-tight text-zinc-900 dark:text-foreground">
            {project.codigo_projeto}
          </span>
          {project.urgente && <UrgenteBadge urgente />}
        </div>

        {/* Row 2: construtora */}
        <p className="pl-[19px] text-[12px] font-semibold leading-snug text-zinc-800 dark:text-zinc-200">
          {project.construtora}
        </p>

        {/* Row 3: obra */}
        <p className="pl-[19px] mt-0.5 truncate text-[11px] leading-snug text-zinc-500 dark:text-muted" title={project.obra}>
          {project.obra}
        </p>

        {/* Row 4: deadline badge + review badges */}
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <PrazoBadge project={project} />
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
}: {
  project: Project;
  onOpen: (project: Project) => void;
  recentlyMoved: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: project.id,
    data: { projectId: project.id },
  });

  return (
    <article
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onDoubleClick={() => {
        if (!isDragging) onOpen(project);
      }}
      className={[
        "relative rounded-xl border overflow-hidden select-none",
        isDragging
          ? "cursor-grabbing border-dashed border-zinc-200 dark:border-white/8 bg-zinc-50/60 dark:bg-white/[0.03] opacity-35 shadow-none"
          : [
              "cursor-grab bg-white dark:bg-panel-soft transition-all duration-150",
              "shadow-[0_1px_4px_-1px_rgba(0,0,0,0.06),0_4px_16px_-6px_rgba(0,0,0,0.10)]",
              "hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.10),0_8px_24px_-6px_rgba(0,0,0,0.16)]",
              "hover:-translate-y-px",
            ].join(" "),
      ].join(" ")}
      style={isDragging ? { minHeight: CARD_HEIGHT } : undefined}
    >
      <CardContent project={project} />
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
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
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

// ─── Column ───────────────────────────────────────────────────────────────────

function KanbanColumn({
  status,
  projects,
  onOpen,
  isDragActive,
  isDropTarget,
  recentlyMovedProjectId,
}: {
  status: ProjectStatus;
  projects: Project[];
  onOpen: (project: Project) => void;
  isDragActive: boolean;
  isDropTarget: boolean;
  recentlyMovedProjectId: string | null;
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
        <h3
          className="text-[11px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400 truncate"
          title={theme.label}
        >
          {theme.label}
        </h3>
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
            />
          ))}
        </div>
        {effectiveBottom > 0 && <div style={{ height: effectiveBottom }} />}
      </div>
    </section>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────

export function ProjectsKanban({ projects, onMoveStatus, onOpen, notify }: ProjectsKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<ProjectStatus | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [blockedMove, setBlockedMove] = useState<{ projectId: string; reasons: string[] } | null>(null);
  const [recentlyMovedProjectId, setRecentlyMovedProjectId] = useState<string | null>(null);
  // Bug #4: capture the dragged card's measured width for the overlay
  const [dragCardWidth, setDragCardWidth] = useState<number | undefined>(undefined);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const byStatus = useMemo(
    () =>
      COLUMNS.map((status) => ({
        status,
        projects: projects.filter((p) => p.status_atual === status),
      })),
    [projects],
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

    setPendingMove({
      projectId,
      projectCode: current.codigo_projeto,
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
        fromStatus={pendingMove?.fromStatus}
        toStatus={pendingMove?.nextStatus}
        onCancel={handleCancel}
        onConfirm={handleConfirm}
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
