"use client";

import { useMemo, useState } from "react";
import { ProjectsAlerts } from "./projects-alerts";
import { ProjectFormModal } from "./project-form-modal";
import { ProjectsKanban } from "./projects-kanban";
import { ProjectsTable } from "./projects-table";
import { ProjectsToolbar } from "./projects-toolbar";
import { useProjectsStore } from "@/features/projects/state/projects-store";
import type { Project } from "@/features/projects/domain/project-types";

export function ProjectsPageShell() {
  const {
    activeView,
    setActiveView,
    filters,
    setFilters,
    filteredProjects,
    alertProjects,
    createProject,
    updateProject,
    deleteProject,
    toggleUrgente,
    moveStatus,
    getProjectStatusHistory,
    getProjectObservations,
    isCodigoProjetoDuplicado,
    addObservation,
  } = useProjectsStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Project | undefined>(undefined);
  const [toast, setToast] = useState<string>("");

  const projects = filteredProjects();
  const alerts = alertProjects();
  const history = useMemo(() => (editing ? getProjectStatusHistory(editing.id) : []), [editing, getProjectStatusHistory]);
  const observations = useMemo(
    () => (editing ? getProjectObservations(editing.id) : []),
    [editing, getProjectObservations],
  );

  function openCreate() {
    setEditing(undefined);
    setModalOpen(true);
  }

  function openEdit(project: Project) {
    setEditing(project);
    setModalOpen(true);
  }

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  }

  return (
    <main className="mx-auto max-w-[1500px] p-4 md:p-6">
      <header className="mb-4">
        <h1 className="text-2xl font-black tracking-tight text-zinc-800 md:text-3xl">Pipeline de Projetos - TSTECK</h1>
        <p className="text-sm text-zinc-600">Gestao local de projetos sem Supabase (fase de interface e regras).</p>
      </header>

      <ProjectsToolbar
        view={activeView}
        onViewChange={setActiveView}
        onNewProject={openCreate}
        filters={filters}
        onFiltersChange={setFilters}
      />

      <section className="mt-4">
        {activeView === "table" && (
          <ProjectsTable projects={projects} onOpen={openEdit} onToggleUrgente={toggleUrgente} />
        )}
        {activeView === "kanban" && (
          <ProjectsKanban
            projects={projects}
            onOpen={openEdit}
            onMoveStatus={(projectId, status) => {
              const result = moveStatus(projectId, status, "kanban");
              if (!result.ok) notify(result.error ?? "Falha na movimentacao");
              return result;
            }}
          />
        )}
        {activeView === "alerts" && <ProjectsAlerts projects={alerts} onOpen={openEdit} />}
      </section>

      <ProjectFormModal
        open={modalOpen}
        mode={editing ? "edit" : "create"}
        project={editing}
        statusHistory={history}
        observations={observations}
        onClose={() => setModalOpen(false)}
        onCreate={(input) => createProject(input as Parameters<typeof createProject>[0])}
        onUpdate={updateProject}
        onDelete={deleteProject}
        onToggleUrgente={toggleUrgente}
        onMoveStatus={(id, status) => moveStatus(id, status, "formulario")}
        isCodigoDuplicado={isCodigoProjetoDuplicado}
        onAddObservation={(id, text) => addObservation(id, text, "usuario.local")}
        notify={notify}
      />

      {toast && (
        <div className="fixed right-4 bottom-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>
      )}
    </main>
  );
}
