"use client";

import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState } from "react";
import { GripVertical } from "lucide-react";
import type { Project, ProjectStatus } from "@/features/projects/domain/project-types";
import { computeNextAction, computePrazoBadge, computePrazoEntrega, todayIsoDate } from "@/features/projects/domain/project-rules";
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

type ProjectsKanbanProps = {
  projects: Project[];
  onMoveStatus: (projectId: string, nextStatus: ProjectStatus, observation?: string) => { ok: boolean; error?: string };
  onOpen: (project: Project) => void;
  notify: (message: string) => void;
};

function KanbanCard({ project, onOpen, dragging = false }: { project: Project; onOpen: (project: Project) => void; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: project.id,
    data: { projectId: project.id },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    transition: isDragging ? "none" : "transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 180ms ease",
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab rounded-xl border bg-white p-3 shadow-[0_14px_24px_-20px_rgba(0,0,0,0.45)] transition ${dragging ? "shadow-[0_20px_34px_-18px_rgba(0,0,0,0.55)] ring-1 ring-brand/20" : "hover:-translate-y-0.5"} ${project.urgente ? "border-red-200" : "border-line"}`}
      onDoubleClick={() => onOpen(project)}
    >
      <div className="mb-2 flex items-center gap-2">
        <GripVertical size={14} className="text-zinc-400" />
        <strong className="text-sm text-zinc-900">{project.codigo_projeto}</strong>
        <UrgenteBadge urgente={project.urgente} />
      </div>
      <p className="text-xs text-zinc-700">{project.construtora}</p>
      <p className="text-xs text-zinc-500">{project.obra}</p>
      <div className="mt-2">
        <PrazoBadge project={project} />
      </div>
      <p className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-semibold text-zinc-700">
        Proxima acao: {computeNextAction(project)}
      </p>
    </article>
  );
}

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

function KanbanColumn({
  status,
  projects,
  onOpen,
  activeId,
}: {
  status: ProjectStatus;
  projects: Project[];
  onOpen: (project: Project) => void;
  activeId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [scrollTop, setScrollTop] = useState(0);
  const { start, end, top, bottom } = useVirtualSlice(projects.length, scrollTop);
  const visibleProjects = projects.slice(start, end);

  const urgentCount = useMemo(() => projects.filter((item) => item.urgente).length, [projects]);
  const nearDeadlineCount = useMemo(
    () =>
      projects.filter((item) => {
        const badge = computePrazoBadge(todayIsoDate(), computePrazoEntrega(item.data_alinhamento, item.proj_obra_recebido && item.local_cabine_definido));
        return badge === "atencao" || badge === "atrasado";
      }).length,
    [projects],
  );

  return (
    <section className={`min-h-44 rounded-2xl border p-3 ${isOver ? "border-brand bg-brand/5" : "border-line bg-white/75"}`}>
      <header className="mb-3 border-b border-dashed border-zinc-200 pb-2">
        <h3 className="text-xs font-bold tracking-wide text-zinc-700 uppercase">{status}</h3>
        <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
          <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-700">{projects.length} projetos</span>
          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-semibold text-red-700">{urgentCount} urgentes</span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">{nearDeadlineCount} no prazo critico</span>
        </div>
      </header>

      <div
        ref={setNodeRef}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        className={`overflow-y-auto pr-1 ${isOver ? "ring-1 ring-brand/20" : ""}`}
        style={{ maxHeight: `${COLUMN_VIEWPORT_HEIGHT}px` }}
      >
        {top > 0 && <div style={{ height: top }} />}

        <div className="space-y-2">
          {visibleProjects.map((project) => (
            <KanbanCard key={project.id} project={project} onOpen={onOpen} dragging={activeId === project.id} />
          ))}
        </div>

        {bottom > 0 && <div style={{ height: bottom }} />}
      </div>
    </section>
  );
}

export function ProjectsKanban({ projects, onMoveStatus, onOpen, notify }: ProjectsKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ projectId: string; nextStatus: ProjectStatus } | null>(null);

  const byStatus = useMemo(() => {
    return COLUMNS.map((status) => ({
      status,
      projects: projects.filter((project) => project.status_atual === status),
    }));
  }, [projects]);

  const activeProject = useMemo(() => projects.find((project) => project.id === activeId), [projects, activeId]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const projectId = String(event.active.id);
    const targetStatus = event.over?.id as ProjectStatus | undefined;
    if (!targetStatus) {
      setActiveId(null);
      return;
    }

    const current = projects.find((project) => project.id === projectId);
    if (!current || current.status_atual === targetStatus) {
      setActiveId(null);
      return;
    }

    setPendingMove({ projectId, nextStatus: targetStatus });
    setActiveId(null);
  }

  const pendingProject = pendingMove
    ? projects.find((project) => project.id === pendingMove.projectId)
    : undefined;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {byStatus.map((column) => (
          <KanbanColumn
            key={column.status}
            status={column.status}
            projects={column.projects}
            onOpen={onOpen}
            activeId={activeId}
          />
        ))}
      </div>

      <DragOverlay>
        {activeProject ? <KanbanCard project={activeProject} onOpen={onOpen} dragging /> : null}
      </DragOverlay>

      <KanbanStatusChangeDialog
        open={Boolean(pendingMove && pendingProject)}
        projectCode={pendingProject?.codigo_projeto}
        fromStatus={pendingProject?.status_atual}
        toStatus={pendingMove?.nextStatus}
        onCancel={() => setPendingMove(null)}
        onConfirm={(observation) => {
          if (!pendingMove) return;
          const result = onMoveStatus(pendingMove.projectId, pendingMove.nextStatus, observation);
          if (!result.ok) {
            notify(result.error ?? "Falha ao atualizar status no Kanban.");
          } else {
            notify("Status atualizado via Kanban.");
          }
          setPendingMove(null);
        }}
      />
    </DndContext>
  );
}
