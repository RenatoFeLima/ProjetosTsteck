"use client";

// Modal de alerta estilo Outlook: exibido ao entrar no sistema (máx. 1x por
// sessão — controle na shell via sessionStorage) quando há lembretes VENCIDOS
// ou DO DIA para a equipe de Projetos. As ações (Abrir projeto / Adiar /
// Resolver) atualizam a lista na hora; os indicadores do card e a tela de
// Alertas continuam mostrando os lembretes até serem resolvidos/adiado.

import { useEffect } from "react";
import { BellRing, CheckCircle2, ExternalLink, X } from "lucide-react";
import {
  reminderDaysOverdue,
  getReminderDueState,
  type ProjectReminder,
} from "@/features/projects/domain/project-reminders";
import { todayIsoDate } from "@/features/projects/domain/project-rules";
import type { Project } from "@/features/projects/domain/project-types";
import { ReminderPriorityChip, ReminderPostponeMenu, ReminderStateBadge } from "./reminder-badges";

type ReminderAlertDialogProps = {
  open: boolean;
  /** Lembretes vencidos/do dia, já ordenados por criticidade. */
  reminders: ProjectReminder[];
  projects: Project[];
  /** Ações só aparecem para quem pode gerenciar (ADMIN/Projetos). */
  canManage: boolean;
  onClose: () => void;
  onOpenProject: (project: Project) => void;
  onPostpone: (id: string, date: string) => void;
  onResolve: (id: string) => void;
};

export function ReminderAlertDialog({
  open,
  reminders,
  projects,
  canManage,
  onClose,
  onOpenProject,
  onPostpone,
  onResolve,
}: ReminderAlertDialogProps) {
  const today = todayIsoDate();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  // A shell controla `open` (inclui fechar quando a lista esvazia após
  // resolver/adiar tudo dentro do próprio modal).
  if (!open || reminders.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[96] grid place-items-center bg-black/50 p-4">
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-alert-title"
        className="flex w-full max-w-[640px] max-h-[85vh] animate-[fadeScaleIn_150ms_ease-out] flex-col rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel shadow-[0_32px_64px_-20px_rgba(0,0,0,0.35)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-zinc-100 dark:border-white/8 p-5 pb-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300">
              <BellRing size={18} />
            </span>
            <div>
              <h2 id="reminder-alert-title" className="text-lg font-bold text-zinc-900 dark:text-foreground">
                Lembretes pendentes
              </h2>
              <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">
                {reminders.length === 1
                  ? "1 lembrete vencido ou para hoje."
                  : `${reminders.length} lembretes vencidos ou para hoje.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar lembretes"
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/8 dark:hover:text-zinc-200"
          >
            <X size={18} />
          </button>
        </header>

        <div className="grid gap-2 overflow-y-auto p-5 pt-4">
          {reminders.map((reminder) => {
            const project = projects.find((p) => p.id === reminder.projeto_id);
            const state = getReminderDueState(reminder, today);
            const overdue = reminderDaysOverdue(reminder, today);
            return (
              <section
                key={reminder.id}
                className={[
                  "rounded-xl border p-3",
                  state === "vencido"
                    ? "border-red-200 bg-red-50/50 dark:border-red-700/40 dark:bg-red-900/10"
                    : "border-amber-200 bg-amber-50/50 dark:border-amber-700/30 dark:bg-amber-900/10",
                ].join(" ")}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  {project && (
                    <strong className="font-mono text-[12.5px] font-bold text-zinc-900 dark:text-foreground">
                      {project.codigo_projeto}
                    </strong>
                  )}
                  <ReminderStateBadge reminder={reminder} todayISO={today} />
                  <ReminderPriorityChip prioridade={reminder.prioridade} />
                  {state === "vencido" && overdue > 0 && (
                    <span className="text-[11px] font-semibold text-red-600 dark:text-red-300">
                      {overdue} {overdue === 1 ? "dia vencido" : "dias vencidos"}
                    </span>
                  )}
                </div>
                {project && (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {project.construtora} — {project.obra}
                  </p>
                )}
                <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{reminder.descricao}</p>

                <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                  {project && (
                    <button
                      type="button"
                      onClick={() => onOpenProject(project)}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel-soft px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-white/8"
                    >
                      <ExternalLink size={12} />
                      Abrir projeto
                    </button>
                  )}
                  {canManage && (
                    <>
                      <ReminderPostponeMenu todayISO={today} onPostpone={(date) => onPostpone(reminder.id, date)} />
                      <button
                        type="button"
                        onClick={() => onResolve(reminder.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-emerald-700"
                      >
                        <CheckCircle2 size={12} />
                        Marcar como resolvido
                      </button>
                    </>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </article>
    </div>
  );
}
