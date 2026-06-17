"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import type { Project } from "@/features/projects/domain/project-types";

type UrgencyProjectInfo = Pick<Project, "id" | "codigo_projeto" | "construtora" | "obra">;

type UrgencyPayload = {
  projectId: string;
  urgencyReason: string;
  urgentDeadline: string;
  updatedAt: string;
  updatedBy: string;
};

type UrgencyJustificationDialogProps = {
  open: boolean;
  project?: UrgencyProjectInfo;
  onCancel: () => void;
  onConfirm: (payload: UrgencyPayload) => void;
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
  const [deadline, setDeadline] = useState("");
  const [touched, setTouched] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  function resetLocalState() {
    setReason("");
    setDeadline("");
    setTouched(false);
  }

  function handleCancel() {
    resetLocalState();
    onCancel();
  }

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => dateRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        resetLocalState();
        onCancel();
        return;
      }

      if (event.key !== "Tab") return;

      const focusables = [dateRef.current, textAreaRef.current, cancelRef.current, confirmRef.current].filter(Boolean) as HTMLElement[];
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onCancel]);

  const trimmedReason = reason.trim();
  const validReason = trimmedReason.length >= MIN_REASON;
  const validDeadline = Boolean(deadline);
  const isValid = validReason && validDeadline;

  const reasonError = useMemo(() => {
    if (!touched) return "";
    if (!trimmedReason) return "Informe o motivo da urgência.";
    if (!validReason) return `O motivo deve ter no mínimo ${MIN_REASON} caracteres.`;
    return "";
  }, [touched, trimmedReason, validReason]);

  const deadlineError = touched && !validDeadline ? "Informe o prazo de urgência." : "";

  if (!open || !project) return null;

  const content = (
    <div data-testid="urgency-deadline-dialog" className="fixed inset-0 z-[999999] grid place-items-center bg-black/50 p-4">
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
            <h2 id="urgency-title" className="text-lg font-bold text-zinc-900 dark:text-foreground">Definir prazo de urgência</h2>
            <p id="urgency-description" className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Informe o novo prazo de entrega e o motivo da urgência. Esses dados ficam registrados no histórico do projeto.
            </p>
          </div>
        </header>

        <div className="grid gap-3 rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50/70 dark:bg-panel-soft p-3 text-sm">
          <p><span className="font-semibold text-zinc-700 dark:text-zinc-300">Projeto:</span> <span className="font-mono text-zinc-900 dark:text-foreground">{project.codigo_projeto}</span></p>
          <p><span className="font-semibold text-zinc-700 dark:text-zinc-300">Construtora / Obra:</span> <span className="text-zinc-900 dark:text-foreground">{project.construtora} / {project.obra}</span></p>
        </div>

        {/* Data de prazo */}
        <div className="mt-4">
          <label htmlFor="urgency-deadline" className="mb-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Novo prazo de entrega <span className="text-brand">*</span>
          </label>
          <input
            id="urgency-deadline"
            ref={dateRef}
            type="date"
            value={deadline}
            onBlur={() => setTouched(true)}
            onChange={(e) => setDeadline(e.target.value)}
            min={new Date().toISOString().slice(0, 10)}
            className={`w-full rounded-xl border bg-white dark:bg-panel-soft dark:text-foreground p-3 text-sm outline-none transition ${deadlineError ? "border-brand" : "border-zinc-300 dark:border-white/8 focus:border-brand"}`}
          />
          {deadlineError && <p className="mt-1 text-xs font-medium text-brand">{deadlineError}</p>}
        </div>

        {/* Motivo */}
        <div className="mt-3">
          <label htmlFor="urgency-reason" className="mb-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Motivo da urgência <span className="text-brand">*</span>
          </label>
          <textarea
            id="urgency-reason"
            ref={textAreaRef}
            value={reason}
            onBlur={() => setTouched(true)}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ex: cliente solicitou prioridade, obra com prazo crítico, pendência técnica urgente..."
            className={`min-h-24 w-full rounded-xl border bg-white dark:bg-panel-soft dark:text-foreground dark:placeholder:text-zinc-600 p-3 text-sm outline-none transition ${reasonError ? "border-brand" : "border-zinc-300 dark:border-white/8 focus:border-brand"}`}
          />
          {reasonError && <p className="mt-1 text-xs font-medium text-brand">{reasonError}</p>}
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
            disabled={!isValid || isSaving}
            onClick={() => {
              if (!isValid) {
                setTouched(true);
                return;
              }
              onConfirm({
                projectId: project.id,
                urgencyReason: trimmedReason,
                urgentDeadline: deadline,
                updatedAt: new Date().toISOString(),
                updatedBy: "usuario.local",
              });
              resetLocalState();
            }}
            className="rounded-xl bg-[#9e0b0f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7f090c] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          >
            {isSaving ? "Confirmando..." : "Confirmar urgência"}
          </button>
        </footer>
      </article>
    </div>
  );

  return createPortal(content, document.body);
}
