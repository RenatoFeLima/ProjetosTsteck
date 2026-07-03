"use client";

// Seção "Lembretes" do drawer do projeto: lista ativos / resolvidos / removidos
// e concentra as ações (criar, editar, adiar, resolver, remover) conforme a
// permissão. Auto-contida: lê os lembretes do store e possui seus próprios
// dialogs (formulário + confirmação de remoção).

import { useMemo, useState } from "react";
import { BellPlus, BellRing, CheckCircle2, PencilLine, Trash2 } from "lucide-react";
import {
  activeRemindersForProject,
  type ProjectReminder,
} from "@/features/projects/domain/project-reminders";
import { todayIsoDate } from "@/features/projects/domain/project-rules";
import type { Project } from "@/features/projects/domain/project-types";
import { useProjectsStore } from "@/features/projects/state/projects-store";
import { ReminderFormDialog, type ReminderFormValue } from "./reminder-form-dialog";
import { ReminderPostponeMenu, ReminderPriorityChip, ReminderStateBadge } from "./reminder-badges";
import { formatUrgentDeadline } from "./pill-badges";

type ProjectRemindersSectionProps = {
  project: Project;
  /** ADMIN/Projetos gerenciam; demais perfis veem somente leitura. */
  canManage: boolean;
};

/** Confirmação antes de remover (compartilhada com a tela de Alertas). */
export function ReminderRemoveConfirmDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[97] grid place-items-center bg-black/50 p-4">
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-remove-title"
        className="w-full max-w-[440px] animate-[fadeScaleIn_150ms_ease-out] rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-6 shadow-[0_32px_64px_-20px_rgba(0,0,0,0.35)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="reminder-remove-title" className="text-lg font-bold text-zinc-900 dark:text-foreground">
          Remover lembrete
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Tem certeza que deseja remover este lembrete? Essa ação irá encerrar os alertas recorrentes deste
          lembrete.
        </p>
        <footer className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel-soft px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-white/8"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            <Trash2 size={14} />
            Remover lembrete
          </button>
        </footer>
      </article>
    </div>
  );
}

export function ProjectRemindersSection({ project, canManage }: ProjectRemindersSectionProps) {
  const reminders = useProjectsStore((s) => s.reminders);
  const createReminder = useProjectsStore((s) => s.createReminder);
  const updateReminder = useProjectsStore((s) => s.updateReminder);
  const postponeReminder = useProjectsStore((s) => s.postponeReminder);
  const resolveReminder = useProjectsStore((s) => s.resolveReminder);
  const removeReminder = useProjectsStore((s) => s.removeReminder);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectReminder | null>(null);
  const [removing, setRemoving] = useState<ProjectReminder | null>(null);

  const today = todayIsoDate();
  const active = useMemo(
    () => activeRemindersForProject(reminders, project.id, today),
    [reminders, project.id, today],
  );
  const resolved = useMemo(
    () => reminders.filter((r) => r.projeto_id === project.id && r.status === "RESOLVIDO"),
    [reminders, project.id],
  );
  const removed = useMemo(
    () => reminders.filter((r) => r.projeto_id === project.id && r.status === "CANCELADO"),
    [reminders, project.id],
  );

  async function handleSave(value: ReminderFormValue): Promise<{ ok: boolean; error?: string }> {
    const result = editing
      ? await updateReminder(editing.id, {
          descricao: value.descricao,
          prioridade: value.prioridade,
          proxima_data: value.data_inicial,
          recorrencia_dias: value.recorrencia_dias,
        })
      : await createReminder(project.id, value);
    if (result.ok) {
      setFormOpen(false);
      setEditing(null);
    }
    return result;
  }

  return (
    <section className="rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-3">
      <header className="mb-2 flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-1.5 text-sm font-bold text-zinc-900 dark:text-foreground">
          <BellRing size={14} className="text-zinc-500 dark:text-zinc-400" />
          Lembretes
          {active.length > 0 && (
            <span className="rounded-full border border-zinc-200 dark:border-white/8 bg-zinc-100 dark:bg-white/8 px-1.5 py-px text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
              {active.length}
            </span>
          )}
        </h3>
        {canManage && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel-soft px-2.5 py-1 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-white/8"
          >
            <BellPlus size={12} />
            Criar lembrete
          </button>
        )}
      </header>

      {active.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-200 dark:border-white/10 px-3 py-2 text-xs text-zinc-500 dark:text-muted">
          Nenhum lembrete ativo nesta obra.
        </p>
      ) : (
        <div className="grid gap-2">
          {active.map((reminder) => (
            <article
              key={reminder.id}
              className="rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft p-2.5"
            >
              <div className="mb-1 flex flex-wrap items-center gap-1.5">
                <ReminderStateBadge reminder={reminder} todayISO={today} />
                <ReminderPriorityChip prioridade={reminder.prioridade} />
                <span className="text-[10px] text-zinc-500 dark:text-muted">
                  repete a cada {reminder.recorrencia_dias}d
                </span>
              </div>
              <p className="text-sm text-zinc-800 dark:text-zinc-200">{reminder.descricao}</p>
              <p className="mt-1 text-[10.5px] text-zinc-500 dark:text-muted">
                Próximo alerta: {formatUrgentDeadline(reminder.proxima_data)} · criado por {reminder.criado_por} em{" "}
                {formatUrgentDeadline(reminder.criado_em)}
                {reminder.adiado_por ? ` · adiado por ${reminder.adiado_por}` : ""}
              </p>
              {canManage && (
                <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(reminder);
                      setFormOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel px-2 py-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-100 dark:hover:bg-white/8"
                  >
                    <PencilLine size={11} />
                    Editar
                  </button>
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
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {(resolved.length > 0 || removed.length > 0) && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-semibold text-zinc-500 dark:text-muted">
            Histórico ({resolved.length} resolvido{resolved.length === 1 ? "" : "s"}, {removed.length} removido
            {removed.length === 1 ? "" : "s"})
          </summary>
          <div className="mt-1.5 grid gap-1.5">
            {[...resolved, ...removed].map((reminder) => (
              <p
                key={reminder.id}
                className="rounded-lg border border-zinc-100 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.03] px-2 py-1.5 text-[11px] text-zinc-500 dark:text-zinc-400"
              >
                <span
                  className={
                    reminder.status === "RESOLVIDO"
                      ? "font-semibold text-emerald-600 dark:text-emerald-400"
                      : "font-semibold text-zinc-400 line-through dark:text-zinc-500"
                  }
                >
                  {reminder.status === "RESOLVIDO" ? "Resolvido" : "Removido"}
                </span>{" "}
                — {reminder.descricao}
                {reminder.status === "RESOLVIDO" && reminder.resolvido_por
                  ? ` (por ${reminder.resolvido_por} em ${formatUrgentDeadline(reminder.resolvido_em ?? "")})`
                  : ""}
                {reminder.status === "CANCELADO" && reminder.cancelado_por
                  ? ` (por ${reminder.cancelado_por} em ${formatUrgentDeadline(reminder.cancelado_em ?? "")})`
                  : ""}
              </p>
            ))}
          </div>
        </details>
      )}

      <ReminderFormDialog
        open={formOpen}
        project={project}
        reminder={editing}
        onCancel={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />
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
