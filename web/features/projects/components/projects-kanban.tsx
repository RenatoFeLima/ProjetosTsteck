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
  computePrazoBadge,
  computePrazoEntrega,
  todayIsoDate,
} from "@/features/projects/domain/project-rules";
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

// ─── Shared card content ─────────────────────────────────────────────────────

function CardContent({ project }: { project: Project }) {
  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        <GripVertical size={14} className="text-zinc-400 dark:text-zinc-600" />
        <strong className="text-sm text-zinc-900 dark:text-foreground">{project.codigo_projeto}</strong>
        <UrgenteBadge urgente={project.urgente} />
      </div>
      <p className="text-xs text-zinc-700 dark:text-zinc-300">{project.construtora}</p>
      <p className="text-xs text-zinc-500 dark:text-muted">{project.obra}</p>
      <div className="mt-2">
        <PrazoBadge project={project} />
      </div>
      <p className="mt-2 rounded-md border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft px-2 py-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
        Proxima acao: {computeNextAction(project)}
      </p>
    </>
  );
}

// ─── Column card — ghost while being dragged ─────────────────────────────────
// Bug #5: transition only applied when NOT dragging (prevents 150ms flash on drag start)
// Bug #5: hover:-translate-y-0.5 removed (conflicts with dnd-kit transforms)
// Bug #2B: minHeight on ghost prevents virtual-scroll layout jumps during drag

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
        "relative rounded-xl border p-3 select-none",
        isDragging
          ? "cursor-grabbing border-dashed border-zinc-300 dark:border-white/15 bg-zinc-50/60 dark:bg-white/5 opacity-35 shadow-none"
          : [
              "cursor-grab bg-white dark:bg-panel-soft transition-all duration-150",
              "shadow-[0_14px_24px_-20px_rgba(0,0,0,0.45)]",
              "hover:shadow-[0_18px_28px_-18px_rgba(0,0,0,0.38)]",
              project.urgente ? "border-red-200 dark:border-red-700/50" : "border-line",
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
// Bug #4: width passed in so the overlay matches the original card's column width

function DragOverlayCard({ project, width }: { project: Project; width?: number }) {
  return (
    <article
      className={[
        "cursor-grabbing select-none rounded-xl border bg-white dark:bg-panel-soft p-3",
        "shadow-[0_24px_48px_-12px_rgba(0,0,0,0.28)] ring-1",
        project.urgente ? "border-red-200 dark:border-red-700/50 ring-red-100 dark:ring-red-700/20" : "border-zinc-200 dark:border-white/8 ring-zinc-200 dark:ring-white/5",
      ].join(" ")}
      style={{
        width: width ?? undefined,
        transform: "scale(1.03)",
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
  const from = project.status_atual;
  const reasons: string[] = [];

  if (from === "CADASTRO INICIAL" && toStatus !== "ELABORAR ANTE-PROJETO") {
    reasons.push("De Cadastro Inicial, o projeto so pode avancar para Elaborar Ante-Projeto.");
    return reasons;
  }

  if (from !== "CADASTRO INICIAL" && toStatus === "CADASTRO INICIAL") {
    reasons.push("Projetos ja liberados nao podem retornar automaticamente para Cadastro Inicial.");
    return reasons;
  }

  if (!project.alinhamento) {
    if (!project.proj_obra_recebido) {
      reasons.push("Projeto de obra do cliente nao recebido.");
    }
    if (!project.local_cabine_definido) {
      reasons.push("Local da cabine nao definido.");
    }
    reasons.push("Alinhamento nao concluido.");
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
  // Bug #1C: ref on <section> so the entire column area is the drop target,
  // not just the inner scroll container (which caused missed drops at column edges)
  const { setNodeRef } = useDroppable({ id: status });
  const [scrollTop, setScrollTop] = useState(0);
  const { start, end, top, bottom } = useVirtualSlice(projects.length, scrollTop);

  // Bug #2A: disable virtualization during drag so the dragged card's DOM node
  // always exists (virtual slice could exclude it if the column scrolled)
  const effectiveProjects = isDragActive ? projects : projects.slice(start, end);
  const effectiveTop = isDragActive ? 0 : top;
  const effectiveBottom = isDragActive ? 0 : bottom;

  const urgentCount = useMemo(() => projects.filter((p) => p.urgente).length, [projects]);
  const nearDeadlineCount = useMemo(
    () =>
      projects.filter((p) => {
        const badge = computePrazoBadge(
          todayIsoDate(),
          computePrazoEntrega(
            p.data_alinhamento,
            p.proj_obra_recebido && p.local_cabine_definido,
          ),
        );
        return badge === "atencao" || badge === "atrasado";
      }).length,
    [projects],
  );

  return (
    <section
      ref={setNodeRef}
      className={[
        "min-h-44 rounded-2xl border p-3 transition-colors duration-150",
        isDropTarget
          ? "border-[#9e0b0f]/25 bg-red-50/25 dark:bg-red-900/10"
          : isDragActive
            ? "border-line bg-white/60 dark:bg-white/5"
            : "border-line bg-white/75 dark:bg-panel",
      ].join(" ")}
    >
      <header className="mb-3 border-b border-dashed border-zinc-200 dark:border-white/10 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">{status}</h3>
        <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
          <span className="rounded-full border border-zinc-200 dark:border-white/8 bg-zinc-100 dark:bg-white/8 px-2 py-0.5 font-semibold text-zinc-700 dark:text-zinc-300">
            {projects.length} projetos
          </span>
          <span className="rounded-full border border-red-200 dark:border-red-700/40 bg-red-50 dark:bg-red-900/15 px-2 py-0.5 font-semibold text-red-700 dark:text-red-300">
            {urgentCount} urgentes
          </span>
          <span className="rounded-full border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/15 px-2 py-0.5 font-semibold text-amber-700 dark:text-amber-300">
            {nearDeadlineCount} no prazo critico
          </span>
        </div>
      </header>

      <div
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        className={[
          "overflow-y-auto rounded-xl pr-1 transition-all duration-150",
          isDropTarget ? "ring-1 ring-[#9e0b0f]/20" : "",
        ].join(" ")}
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
