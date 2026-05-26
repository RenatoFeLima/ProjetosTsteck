"use client";

import { DndContext, DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Project, ProjectStatus } from "@/features/projects/domain/project-types";
import { PrazoBadge, UrgenteBadge } from "./pill-badges";

const COLUMNS: ProjectStatus[] = [
  "ELABORAR ANTE-PROJETO",
  "ANTE-PROJETO ENVIADO",
  "ANTE-PROJETO APROVADO",
  "PROJETO APROVADO",
  "PROJETO FINAL ENVIADO",
  "REVISAO DE ESTUDO",
];

type ProjectsKanbanProps = {
  projects: Project[];
  onMoveStatus: (projectId: string, nextStatus: ProjectStatus) => { ok: boolean; error?: string };
  onOpen: (project: Project) => void;
};

function KanbanCard({ project, onOpen }: { project: Project; onOpen: (project: Project) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: project.id,
    data: { projectId: project.id },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab rounded-xl border border-zinc-200 bg-white p-3 shadow-sm"
      onDoubleClick={() => onOpen(project)}
    >
      <div className="mb-2 flex items-center gap-2">
        <strong className="text-sm">{project.codigo_projeto}</strong>
        <UrgenteBadge urgente={project.urgente} />
      </div>
      <p className="text-xs text-zinc-700">{project.construtora}</p>
      <p className="text-xs text-zinc-500">{project.obra}</p>
      <div className="mt-2">
        <PrazoBadge project={project} />
      </div>
    </article>
  );
}

function KanbanColumn({
  status,
  projects,
  onOpen,
}: {
  status: ProjectStatus;
  projects: Project[];
  onOpen: (project: Project) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      className={`min-h-44 rounded-2xl border p-3 ${
        isOver ? "border-brand bg-emerald-50/40" : "border-zinc-200 bg-white/75"
      }`}
    >
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-zinc-700">{status}</h3>
      <div className="space-y-2">
        {projects.map((project) => (
          <KanbanCard key={project.id} project={project} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
}

export function ProjectsKanban({ projects, onMoveStatus, onOpen }: ProjectsKanbanProps) {
  const byStatus = COLUMNS.map((status) => ({
    status,
    projects: projects.filter((project) => project.status_atual === status),
  }));

  function handleDragEnd(event: DragEndEvent) {
    const projectId = String(event.active.id);
    const targetStatus = event.over?.id as ProjectStatus | undefined;
    if (!targetStatus) return;
    onMoveStatus(projectId, targetStatus);
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {byStatus.map((column) => (
          <KanbanColumn
            key={column.status}
            status={column.status}
            projects={column.projects}
            onOpen={onOpen}
          />
        ))}
      </div>
    </DndContext>
  );
}
