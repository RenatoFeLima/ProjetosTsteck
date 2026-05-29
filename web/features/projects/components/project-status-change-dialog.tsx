"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { PROJECT_STATUSES, type Project, type ProjectStatus } from "@/features/projects/domain/project-types";

type ProjectStatusChangeDialogProps = {
  open: boolean;
  project?: Project;
  onCancel: () => void;
  onConfirm: (nextStatus: ProjectStatus, observation?: string) => void;
};

export function ProjectStatusChangeDialog({
  open,
  project,
  onCancel,
  onConfirm,
}: ProjectStatusChangeDialogProps) {
  const [nextStatus, setNextStatus] = useState<ProjectStatus | "">("");
  const [observation, setObservation] = useState("");
  const [touched, setTouched] = useState(false);

  function resetLocalState() {
    setNextStatus("");
    setObservation("");
    setTouched(false);
  }

  const requiresObservation = nextStatus === "REVISAO DE ESTUDO";
  const observationValid = observation.trim().length >= 10;
  const canSubmit = Boolean(nextStatus) && (!requiresObservation || observationValid);

  const statusOptions = useMemo(
    () => PROJECT_STATUSES.filter((status) => status !== project?.status_atual),
    [project?.status_atual],
  );

  if (!open || !project) return null;

  return (
    <div
      className="fixed inset-0 z-[98] grid place-items-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-change-title"
        className="w-full max-w-xl rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-6 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="mb-3 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-white/8 text-zinc-700 dark:text-zinc-300">
            <ArrowRightLeft size={18} />
          </span>
          <div>
            <h2 id="status-change-title" className="text-lg font-bold text-zinc-900 dark:text-foreground">Alterar status do projeto</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Essa alteracao sera registrada no historico operacional.</p>
          </div>
        </header>

        <div className="space-y-3 rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft p-3 text-sm">
          <p>
            Projeto: <span className="font-mono font-semibold text-zinc-900 dark:text-foreground">{project.codigo_projeto}</span>
          </p>
          <p>
            Status atual: <span className="font-semibold text-zinc-900 dark:text-foreground">{project.status_atual}</span>
          </p>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Novo status</span>
            <select
              value={nextStatus}
              onChange={(event) => setNextStatus(event.target.value as ProjectStatus | "")}
              className="h-10 w-full rounded-lg border border-zinc-300 dark:border-white/8 bg-white dark:bg-panel-soft dark:text-foreground px-3 text-sm"
            >
              <option value="">Selecione...</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
            Observacao {requiresObservation ? "(obrigatoria, minimo 10 caracteres)" : "(opcional)"}
          </label>
          <textarea
            value={observation}
            onChange={(event) => setObservation(event.target.value)}
            onBlur={() => setTouched(true)}
            className="min-h-24 w-full rounded-xl border border-zinc-300 dark:border-white/8 bg-white dark:bg-panel-soft dark:text-foreground dark:placeholder:text-zinc-600 p-3 text-sm outline-none transition focus:border-brand"
            placeholder="Descreva o contexto desta alteracao de status..."
          />
          {requiresObservation && touched && !observationValid && (
            <p className="mt-1 text-xs font-medium text-brand">Informe ao menos 10 caracteres para continuar.</p>
          )}
        </div>

        <footer className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              resetLocalState();
              onCancel();
            }}
            className="rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel-soft px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 dark:hover:bg-white/8"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              if (!nextStatus) return;
              if (requiresObservation && !observationValid) {
                setTouched(true);
                return;
              }
              onConfirm(nextStatus, observation.trim() || undefined);
              resetLocalState();
            }}
            className="rounded-xl bg-[#9e0b0f] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Confirmar mudanca
          </button>
        </footer>
      </article>
    </div>
  );
}
