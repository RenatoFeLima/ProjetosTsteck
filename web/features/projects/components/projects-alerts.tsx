import { differenceInCalendarDays, parseISO } from "date-fns";
import { computeNextAction, computePrazoBadge, computePrazoEntrega, todayIsoDate } from "@/features/projects/domain/project-rules";
import { AlertTriangle, BellRing, Clock3 } from "lucide-react";
import type { Project } from "@/features/projects/domain/project-types";
import { PrazoBadge, StatusBadge, UrgenteBadge } from "./pill-badges";

type ProjectsAlertsProps = {
  projects: Project[];
  onOpen: (project: Project) => void;
};

type AlertGroup = {
  key: string;
  title: string;
  helper: string;
  projects: Project[];
};

function isStalled(project: Project): boolean {
  const today = parseISO(todayIsoDate());
  const updated = parseISO(project.updated_at);
  return differenceInCalendarDays(today, updated) >= 10;
}

function buildAlertGroups(projects: Project[]): AlertGroup[] {
  const today = todayIsoDate();
  const groups: AlertGroup[] = [
    {
      key: "urgent",
      title: "Urgentes",
      helper: "Projetos com prioridade operacional imediata.",
      projects: projects.filter((project) => project.urgente),
    },
    {
      key: "overdue",
      title: "Atrasados",
      helper: "Projetos com prazo ja vencido.",
      projects: projects.filter((project) => computePrazoBadge(today, computePrazoEntrega(project.data_alinhamento, project.proj_obra_recebido && project.local_cabine_definido)) === "atrasado"),
    },
    {
      key: "no-deadline",
      title: "Sem prazo ativo",
      helper: "Projetos fora do cadastro inicial sem prazo definido.",
      projects: projects.filter(
        (project) => project.status_atual !== "CADASTRO INICIAL" && !computePrazoEntrega(project.data_alinhamento, project.proj_obra_recebido && project.local_cabine_definido),
      ),
    },
    {
      key: "near-deadline",
      title: "Proximos do vencimento",
      helper: "Projetos com risco de estourar prazo (ate 15 dias).",
      projects: projects.filter((project) => computePrazoBadge(today, computePrazoEntrega(project.data_alinhamento, project.proj_obra_recebido && project.local_cabine_definido)) === "atencao"),
    },
    {
      key: "stalled",
      title: "Parados ha muitos dias",
      helper: "Projetos sem atualizacao recente no fluxo.",
      projects: projects.filter(isStalled),
    },
    {
      key: "missing-docs",
      title: "Aguardando documentacao",
      helper: "Projeto de obra ainda nao recebido.",
      projects: projects.filter((project) => !project.proj_obra_recebido),
    },
    {
      key: "missing-location",
      title: "Aguardando localizacao da cabine",
      helper: "Local da cabine ainda nao foi confirmado.",
      projects: projects.filter((project) => !project.local_cabine_definido),
    },
    {
      key: "review",
      title: "Revisao de estudo",
      helper: "Projetos em ciclo de revisao tecnica.",
      projects: projects.filter((project) => project.status_atual === "REVISAO DE ESTUDO"),
    },
  ];

  return groups.filter((group) => group.projects.length > 0);
}

export function ProjectsAlerts({ projects, onOpen }: ProjectsAlertsProps) {
  const groups = buildAlertGroups(projects);

  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <section key={group.key} className="rounded-2xl border border-line bg-white p-3 shadow-[0_12px_24px_-22px_rgba(0,0,0,0.45)]">
          <header className="mb-3 flex items-center justify-between gap-2 border-b border-zinc-100 pb-2">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">{group.title}</h3>
              <p className="text-xs text-zinc-500">{group.helper}</p>
            </div>
            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">
              {group.projects.length}
            </span>
          </header>

          <div className="grid gap-2">
            {group.projects.map((project) => (
              <article
                key={`${group.key}-${project.id}`}
                className={`cursor-pointer rounded-xl border bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-[0_16px_24px_-20px_rgba(0,0,0,0.45)] ${
                  project.urgente ? "border-red-200" : "border-line"
                }`}
                onClick={() => onOpen(project)}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-zinc-700">
                    <BellRing size={14} />
                  </span>
                  <strong className="font-display text-base tracking-tight text-zinc-900">{project.codigo_projeto}</strong>
                  <UrgenteBadge urgente={project.urgente} />
                  <StatusBadge status={project.status_atual} />
                </div>

                <p className="text-sm text-zinc-700">
                  {project.construtora} - {project.obra}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <PrazoBadge project={project} />
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                    <Clock3 size={12} />
                    {group.title}
                  </span>
                </div>

                <div className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-600">
                  <span className="font-semibold text-zinc-700">Proxima acao:</span> {computeNextAction(project)}
                </div>

                {(group.key === "urgent" || group.key === "overdue") && (
                  <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                    <AlertTriangle size={12} />
                    Acao recomendada: tratar prioridade alta imediatamente.
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}

      {groups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500">
          Nenhum alerta para os filtros atuais.
        </div>
      )}
    </div>
  );
}
