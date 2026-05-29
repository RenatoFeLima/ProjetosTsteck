"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { Project } from "@/features/projects/domain/project-types";

type UrgencyJustificationDialogProps = {
  open: boolean;
  project?: Project;
  onCancel: () => void;
  onConfirm: (payload: { projectId: string; urgencyReason: string; updatedAt: string; updatedBy: string }) => void;
  isSaving?: boolean;
};

const MIN_REASON = 10;

export function UrgencyJustificationDialog({
  open,
  project,
  onCancel,
  onConfirm,
  isSaving = false,
}: UrgencyJustificationDialogProps) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  function resetLocalState() {
    setReason("");
    setTouched(false);
  }

  function handleCancel() {
    resetLocalState();
    onCancel();
  }

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => textAreaRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setReason("");
        setTouched(false);
        onCancel();
        return;
      }

      if (event.key !== "Tab") return;

      const focusables = [textAreaRef.current, cancelRef.current, confirmRef.current].filter(Boolean) as HTMLElement[];
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

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

  const trimmed = reason.trim();
  const validReason = trimmed.length >= MIN_REASON;
  const showError = touched && !validReason;

  const helperText = useMemo(() => {
    if (!showError) return "";
    if (!trimmed) return "Informe uma justificativa para marcar este projeto como urgente.";
    return `A justificativa deve ter no minimo ${MIN_REASON} caracteres.`;
  }, [showError, trimmed]);

  if (!open || !project) return null;

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/50 p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget) handleCancel();
    }}>
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="urgency-title"
        aria-describedby="urgency-description"
        className="w-full max-w-[640px] animate-[fadeScaleIn_150ms_ease-out] rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-6 shadow-[0_32px_64px_-20px_rgba(0,0,0,0.35)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="mb-4 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-brand">
            <AlertTriangle size={18} />
          </span>
          <div>
            <h2 id="urgency-title" className="text-lg font-bold text-zinc-900 dark:text-foreground">Justificar urgencia do projeto</h2>
            <p id="urgency-description" className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Informe o motivo pelo qual este projeto deve ser tratado como urgente. Essa justificativa ficara registrada no historico do projeto.
            </p>
          </div>
        </header>

        <div className="grid gap-3 rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50/70 dark:bg-panel-soft p-3 text-sm">
          <p><span className="font-semibold text-zinc-700 dark:text-zinc-300">Projeto:</span> <span className="font-mono text-zinc-900 dark:text-foreground">{project.codigo_projeto}</span></p>
          <p><span className="font-semibold text-zinc-700 dark:text-zinc-300">Construtora / Obra:</span> <span className="text-zinc-900 dark:text-foreground">{project.construtora} / {project.obra}</span></p>
        </div>

        <div className="mt-4">
          <label htmlFor="urgency-reason" className="mb-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-200">Justificativa da urgencia</label>
          <textarea
            id="urgency-reason"
            ref={textAreaRef}
            value={reason}
            onBlur={() => setTouched(true)}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Exemplo: cliente solicitou prioridade, obra com prazo critico, necessidade comercial, pendencia tecnica urgente..."
            className={`min-h-28 w-full rounded-xl border bg-white dark:bg-panel-soft dark:text-foreground dark:placeholder:text-zinc-600 p-3 text-sm outline-none transition ${showError ? "border-brand" : "border-zinc-300 dark:border-white/8 focus:border-brand"}`}
          />
          {showError && <p className="mt-1 text-xs font-medium text-brand">{helperText}</p>}
        </div>

        <footer className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={handleCancel}
            className="rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel-soft px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            disabled={!validReason || isSaving}
            onClick={() => {
              if (!validReason) {
                setTouched(true);
                return;
              }
              onConfirm({
                projectId: project.id,
                urgencyReason: trimmed,
                updatedAt: new Date().toISOString(),
                updatedBy: "usuario.local",
              });
              resetLocalState();
            }}
            className="rounded-xl bg-[#9e0b0f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7f090c] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          >
            {isSaving ? "Confirmando..." : "Confirmar urgencia"}
          </button>
        </footer>
      </article>
    </div>
  );
}
