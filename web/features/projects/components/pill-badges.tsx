import { computePrazoBadge, computePrazoEntrega, prazoLabel, todayIsoDate } from "@/features/projects/domain/project-rules";
import type { Project, ProjectStatus } from "@/features/projects/domain/project-types";

export function StatusBadge({ status }: { status: ProjectStatus }) {
  const styleMap: Record<ProjectStatus, string> = {
    "ELABORAR ANTE-PROJETO": "bg-sky-100 text-sky-700",
    "ANTE-PROJETO ENVIADO": "bg-indigo-100 text-indigo-700",
    "ANTE-PROJETO APROVADO": "bg-violet-100 text-violet-700",
    "PROJETO APROVADO": "bg-amber-100 text-amber-700",
    "PROJETO FINAL ENVIADO": "bg-emerald-100 text-emerald-700",
    "REVISAO DE ESTUDO": "bg-orange-100 text-orange-700",
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styleMap[status]}`}>
      {status}
    </span>
  );
}

export function UrgenteBadge({ urgente }: { urgente: boolean }) {
  if (!urgente) return null;
  return (
    <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold tracking-wide text-white">
      URGENTE
    </span>
  );
}

export function PrazoBadge({ project }: { project: Project }) {
  const prazo = computePrazoEntrega(project.data_alinhamento);
  const badge = computePrazoBadge(todayIsoDate(), prazo);
  const label = prazoLabel(todayIsoDate(), prazo);

  const className =
    badge === "atrasado"
      ? "bg-red-100 text-red-700"
      : badge === "atencao"
        ? "bg-yellow-100 text-yellow-700"
        : badge === "no_prazo"
          ? "bg-green-100 text-green-700"
          : "bg-zinc-100 text-zinc-600";

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>{label}</span>
  );
}
