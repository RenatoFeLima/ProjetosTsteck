import { computePrazoBadge, computePrazoEntrega, todayIsoDate } from "@/features/projects/domain/project-rules";
import type { Project } from "@/features/projects/domain/project-types";
import { PrazoBadge, StatusBadge, UrgenteBadge } from "./pill-badges";

type ProjectsAlertsProps = {
  projects: Project[];
  onOpen: (project: Project) => void;
};

function score(project: Project): number {
  if (project.urgente) return 0;
  const badge = computePrazoBadge(todayIsoDate(), computePrazoEntrega(project.data_alinhamento));
  if (badge === "atrasado") return 1;
  if (badge === "atencao") return 2;
  return 3;
}

export function ProjectsAlerts({ projects, onOpen }: ProjectsAlertsProps) {
  const sorted = [...projects].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    if (sa !== sb) return sa - sb;
    return a.codigo_projeto.localeCompare(b.codigo_projeto);
  });

  return (
    <div className="grid gap-3">
      {sorted.map((project) => (
        <article key={project.id} className="cursor-pointer rounded-2xl border border-zinc-200 bg-white p-4" onClick={() => onOpen(project)}>
          <div className="mb-2 flex items-center gap-2">
            <strong>{project.codigo_projeto}</strong>
            <UrgenteBadge urgente={project.urgente} />
            <StatusBadge status={project.status_atual} />
          </div>
          <p className="text-sm text-zinc-700">{project.construtora} - {project.obra}</p>
          <div className="mt-2"><PrazoBadge project={project} /></div>
        </article>
      ))}
      {sorted.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">Nenhum alerta para os filtros atuais.</div>
      )}
    </div>
  );
}
