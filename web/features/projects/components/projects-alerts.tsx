"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BellRing, CheckCircle2, Clock3, ExternalLink, Trash2 } from "lucide-react";
import { computeNextAction, getCurrentStatusDeadline, todayIsoDate } from "@/features/projects/domain/project-rules";
import {
  buildAlertGroups,
  type AlertSeverity,
  type AlertType,
} from "@/features/projects/domain/project-alerts";
import {
  getReminderDueState,
  isActiveReminder,
  reminderCriticality,
  reminderDaysUntil,
  type ProjectReminder,
} from "@/features/projects/domain/project-reminders";
import type { Project } from "@/features/projects/domain/project-types";
import { useProjectsStore } from "@/features/projects/state/projects-store";
import { PrazoBadge, StatusBadge, UrgenteBadge } from "./pill-badges";
import { ReminderPostponeMenu, ReminderPriorityChip, ReminderStateBadge } from "./reminder-badges";
import { ReminderRemoveConfirmDialog } from "./project-reminders-section";

type ProjectsAlertsProps = {
  projects: Project[];
  onOpen: (project: Project) => void;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  /** ADMIN/Projetos podem adiar/resolver/remover lembretes; demais só leem. */
  canManageReminders?: boolean;
};

// ─── Lembretes operacionais na tela de Alertas ────────────────────────────────

type ReminderFilter = "ativos" | "vencidos" | "hoje" | "prox7" | "alta" | "resolvidos" | "removidos";

const REMINDER_FILTERS: Array<{ key: ReminderFilter; label: string }> = [
  { key: "ativos", label: "Ativos" },
  { key: "vencidos", label: "Vencidos" },
  { key: "hoje", label: "Hoje" },
  { key: "prox7", label: "Próximos 7 dias" },
  { key: "alta", label: "Alta prioridade" },
  { key: "resolvidos", label: "Resolvidos" },
  { key: "removidos", label: "Removidos" },
];

function matchesReminderFilter(reminder: ProjectReminder, filter: ReminderFilter, today: string): boolean {
  switch (filter) {
    case "ativos":
      return isActiveReminder(reminder);
    case "vencidos":
      return isActiveReminder(reminder) && getReminderDueState(reminder, today) === "vencido";
    case "hoje":
      return isActiveReminder(reminder) && getReminderDueState(reminder, today) === "hoje";
    case "prox7":
      return (
        isActiveReminder(reminder) &&
        getReminderDueState(reminder, today) === "futuro" &&
        reminderDaysUntil(reminder, today) <= 7
      );
    case "alta":
      return isActiveReminder(reminder) && reminder.prioridade === "ALTA";
    case "resolvidos":
      return reminder.status === "RESOLVIDO";
    case "removidos":
      return reminder.status === "CANCELADO";
  }
}

function RemindersPanel({
  projects,
  onOpen,
  canManage,
}: {
  projects: Project[];
  onOpen: (project: Project) => void;
  canManage: boolean;
}) {
  const reminders = useProjectsStore((s) => s.reminders);
  const postponeReminder = useProjectsStore((s) => s.postponeReminder);
  const resolveReminder = useProjectsStore((s) => s.resolveReminder);
  const removeReminder = useProjectsStore((s) => s.removeReminder);

  const [filter, setFilter] = useState<ReminderFilter>("ativos");
  const [search, setSearch] = useState("");
  const [removing, setRemoving] = useState<ProjectReminder | null>(null);

  const today = todayIsoDate();
  const byProject = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reminders
      .filter((r) => matchesReminderFilter(r, filter, today))
      .filter((r) => {
        // Só lembretes de projetos visíveis nesta tela (respeita filtros globais/escopo).
        const project = byProject.get(r.projeto_id);
        if (!project) return false;
        if (!term) return true;
        const haystack =
          `${project.codigo_projeto} ${project.construtora} ${project.obra} ${project.status_atual} ${r.criado_por} ${r.descricao}`.toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => reminderCriticality(a, today) - reminderCriticality(b, today));
  }, [reminders, filter, search, byProject, today]);

  const activeTotal = useMemo(
    () => reminders.filter((r) => isActiveReminder(r) && byProject.has(r.projeto_id)).length,
    [reminders, byProject],
  );

  return (
    <section className="rounded-2xl border border-line bg-white dark:bg-panel p-3 shadow-[0_12px_24px_-22px_rgba(0,0,0,0.45)]">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-white/8 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="inline-flex items-center gap-1.5 text-sm font-bold text-zinc-900 dark:text-foreground">
            <BellRing size={14} className="text-zinc-500 dark:text-zinc-400" />
            Lembretes operacionais
          </h3>
          <span className="rounded-full border border-zinc-200 dark:border-white/8 bg-zinc-100 dark:bg-white/8 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            {activeTotal} ativo{activeTotal === 1 ? "" : "s"}
          </span>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar por projeto, obra, construtora, criado por..."
          aria-label="Filtrar lembretes"
          className="w-full max-w-[320px] rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel-soft px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 outline-none focus:border-[#9e0b0f]"
        />
      </header>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {REMINDER_FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            aria-pressed={filter === item.key}
            className={[
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
              filter === item.key
                ? "border-[#9e0b0f] bg-[#9e0b0f] text-white"
                : "border-zinc-200 dark:border-white/10 bg-white dark:bg-panel-soft text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/8",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-200 dark:border-white/10 px-3 py-3 text-center text-xs text-zinc-500 dark:text-muted">
          Nenhum lembrete neste filtro.
        </p>
      ) : (
        <div className="grid gap-2">
          {filtered.map((reminder) => {
            const project = byProject.get(reminder.projeto_id);
            if (!project) return null;
            const inactive = !isActiveReminder(reminder);
            return (
              <article
                key={reminder.id}
                className={[
                  "rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft p-2.5",
                  inactive ? "opacity-70" : "",
                ].join(" ")}
              >
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <strong className="font-mono text-[12px] font-bold text-zinc-900 dark:text-foreground">
                    {project.codigo_projeto}
                  </strong>
                  {inactive ? (
                    <span
                      className={
                        reminder.status === "RESOLVIDO"
                          ? "inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-300"
                          : "inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:border-zinc-700/50 dark:bg-zinc-800/40 dark:text-zinc-400"
                      }
                    >
                      {reminder.status === "RESOLVIDO" ? "Resolvido" : "Removido"}
                    </span>
                  ) : (
                    <ReminderStateBadge reminder={reminder} todayISO={today} />
                  )}
                  <ReminderPriorityChip prioridade={reminder.prioridade} />
                  <StatusBadge status={project.status_atual} />
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  {project.construtora} — {project.obra}
                </p>
                <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{reminder.descricao}</p>
                <p className="mt-1 text-[10.5px] text-zinc-500 dark:text-muted">
                  Criado por {reminder.criado_por} · repete a cada {reminder.recorrencia_dias}d
                </p>
                <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => onOpen(project)}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel px-2 py-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-100 dark:hover:bg-white/8"
                  >
                    <ExternalLink size={11} />
                    Abrir projeto
                  </button>
                  {canManage && !inactive && (
                    <>
                      <ReminderPostponeMenu todayISO={today} onPostpone={(date) => postponeReminder(reminder.id, date)} />
                      <button
                        type="button"
                        onClick={() => resolveReminder(reminder.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-700"
                      >
                        <CheckCircle2 size={11} />
                        Resolver
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemoving(reminder)}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-300 dark:border-red-700/50 bg-white dark:bg-panel px-2 py-1 text-[11px] font-semibold text-red-600 dark:text-red-300 transition hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 size={11} />
                        Remover
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ReminderRemoveConfirmDialog
        open={Boolean(removing)}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) removeReminder(removing.id);
          setRemoving(null);
        }}
      />
    </section>
  );
}

const SEVERITY_META: Record<AlertSeverity, { label: string; chip: string; dot: string }> = {
  critico: {
    label: "Crítico",
    chip: "border-red-200 bg-red-50 text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300",
    dot: "bg-[#9e0b0f]",
  },
  atencao: {
    label: "Atenção",
    chip: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  informativo: {
    label: "Informativo",
    chip: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-700/40 dark:bg-sky-900/20 dark:text-sky-300",
    dot: "bg-sky-500",
  },
};

const TYPE_LABEL: Record<AlertType, string> = {
  prazo: "Prazo",
  urgencia: "Urgência",
  revisao: "Revisão",
  cadastro: "Cadastro",
  qualidade: "Qualidade de dados",
};

export function ProjectsAlerts({ projects, onOpen, loading, error, onRetry, canManageReminders = false }: ProjectsAlertsProps) {
  if (loading) {
    return (
      <div className="grid gap-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-line bg-zinc-50 dark:bg-panel-soft"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-700/50 bg-red-50 dark:bg-red-900/20 p-6 text-center">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
          <AlertTriangle size={16} />
          Não foi possível carregar os alertas.
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-xl border border-red-300 dark:border-red-700/50 bg-white dark:bg-panel-soft px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-300 transition hover:bg-red-50 dark:hover:bg-white/8"
          >
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  const groups = buildAlertGroups(projects);

  if (groups.length === 0) {
    return (
      <div className="grid gap-4">
        <RemindersPanel projects={projects} onOpen={onOpen} canManage={canManageReminders} />
        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-white/15 bg-white dark:bg-panel p-8 text-center text-sm text-zinc-500 dark:text-muted">
          Nenhum alerta no momento.
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <RemindersPanel projects={projects} onOpen={onOpen} canManage={canManageReminders} />
      {groups.map((group) => {
        const sev = SEVERITY_META[group.severity];
        return (
          <section
            key={group.key}
            className="rounded-2xl border border-line bg-white dark:bg-panel p-3 shadow-[0_12px_24px_-22px_rgba(0,0,0,0.45)]"
          >
            <header className="mb-3 flex items-start justify-between gap-2 border-b border-zinc-100 dark:border-white/8 pb-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-foreground">{group.title}</h3>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sev.chip}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                    {sev.label}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
                    {TYPE_LABEL[group.type]}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-muted">{group.helper}</p>
              </div>
              <span className="shrink-0 rounded-full border border-zinc-200 dark:border-white/8 bg-zinc-100 dark:bg-white/8 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {group.projects.length}
              </span>
            </header>

            <div className="grid gap-2">
              {group.projects.map((project) => {
                const hasDeadline = getCurrentStatusDeadline(project).hasDeadline;
                return (
                  <article
                    key={`${group.key}-${project.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpen(project)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpen(project);
                      }
                    }}
                    className={`cursor-pointer rounded-xl border bg-white dark:bg-panel-soft p-3 transition hover:-translate-y-0.5 hover:shadow-[0_16px_24px_-20px_rgba(0,0,0,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e0b0f]/40 ${
                      project.urgente ? "border-red-200 dark:border-red-700/50" : "border-line"
                    }`}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 dark:bg-white/8 text-zinc-700 dark:text-zinc-300">
                        <BellRing size={14} />
                      </span>
                      <strong className="font-display text-base tracking-tight text-zinc-900 dark:text-foreground">
                        {project.codigo_projeto}
                      </strong>
                      {project.urgente && <UrgenteBadge urgente urgentDeadline={project.urgentDeadline} />}
                      <StatusBadge status={project.status_atual} />
                    </div>

                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      {project.construtora} - {project.obra}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {/* "Sem prazo" não é exibido aqui: só mostra o prazo quando a etapa tem SLA. */}
                      {hasDeadline && <PrazoBadge project={project} />}
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${sev.chip}`}>
                        <Clock3 size={12} />
                        {group.title}
                      </span>
                    </div>

                    <div className="mt-2 rounded-lg border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">Próxima ação:</span>{" "}
                      {computeNextAction(project)}
                    </div>

                    <p className="mt-2 inline-flex items-start gap-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                      <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" />
                      Ação recomendada: {group.action}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
