"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import type { Project } from "@/features/projects/domain/project-types";

type RemoveUrgencyConfirmDialogProps = {
  open: boolean;
  project?: Project;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RemoveUrgencyConfirmDialog({ open, project, onCancel, onConfirm }: RemoveUrgencyConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCancel();
        return;
      }

      if (event.key !== "Tab") return;

      const first = cancelRef.current;
      const last = confirmRef.current;
      if (!first || !last) return;
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onCancel]);

  if (!open || !project) return null;

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/50 p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel();
    }}>
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-urgency-title"
        aria-describedby="remove-urgency-description"
        className="w-full max-w-[480px] animate-[fadeScaleIn_150ms_ease-out] rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-6 shadow-[0_32px_64px_-20px_rgba(0,0,0,0.35)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="mb-3 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-brand">
            <AlertTriangle size={18} />
          </span>
          <div>
            <h2 id="remove-urgency-title" className="text-lg font-bold text-zinc-900 dark:text-foreground">Remover prioridade urgente?</h2>
            <p id="remove-urgency-description" className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Este projeto deixara de ser tratado como urgente, mas continuara no fluxo normal de acompanhamento.
            </p>
          </div>
        </header>

        <p className="rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300">
          Projeto: <span className="font-mono font-semibold text-zinc-900 dark:text-foreground">{project.codigo_projeto}</span>
        </p>

        <footer className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel-soft px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-[#9e0b0f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7f090c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          >
            Remover urgencia
          </button>
        </footer>
      </article>
    </div>
  );
}
