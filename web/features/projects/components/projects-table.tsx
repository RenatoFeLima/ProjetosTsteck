import type { Project } from "@/features/projects/domain/project-types";
import { PrazoBadge, StatusBadge, UrgenteBadge } from "./pill-badges";

type ProjectsTableProps = {
  projects: Project[];
  onOpen: (project: Project) => void;
  onToggleUrgente: (id: string) => void;
};

export function ProjectsTable({ projects, onOpen, onToggleUrgente }: ProjectsTableProps) {
  if (projects.length === 0) {
    return <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">Nenhum projeto encontrado com os filtros atuais.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-50 text-left text-zinc-600">
          <tr>
            <th className="px-3 py-2">Codigo</th>
            <th className="px-3 py-2">Construtora / Obra</th>
            <th className="px-3 py-2">Vendedor</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Prazo</th>
            <th className="px-3 py-2">Urgente</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id} className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50" onClick={() => onOpen(project)}>
              <td className="px-3 py-2 font-semibold">{project.codigo_projeto}</td>
              <td className="px-3 py-2">
                <div className="font-medium">{project.construtora}</div>
                <div className="text-xs text-zinc-500">{project.obra}</div>
              </td>
              <td className="px-3 py-2">{project.vendedor}</td>
              <td className="px-3 py-2"><StatusBadge status={project.status_atual} /></td>
              <td className="px-3 py-2"><PrazoBadge project={project} /></td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleUrgente(project.id);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1"
                >
                  <UrgenteBadge urgente={project.urgente} />
                  {!project.urgente ? "Marcar" : "Remover"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
