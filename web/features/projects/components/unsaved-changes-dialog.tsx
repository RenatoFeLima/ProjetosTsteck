"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

type UnsavedChangesDialogProps = {
  open: boolean;
  onContinueEditing: () => void;
  onConfirmDiscard: () => void;
};

export function UnsavedChangesDialog({
  open,
  onContinueEditing,
  onConfirmDiscard,
}: UnsavedChangesDialogProps) {
  const continueRef = useRef<HTMLButtonElement>(null);
  const discardRef = useRef<HTMLButtonElement>(null);

  // Trap focus and handle Esc
  useEffect(() => {
    if (!open) return;

    continueRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onContinueEditing();
        return;
      }

      if (event.key === "Tab") {
        const focusable = [continueRef.current, discardRef.current].filter(Boolean) as HTMLButtonElement[];
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onContinueEditing]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center p-4"
      style={{ background: "rgba(0,0,0,0.52)" }}
      // clicking the overlay keeps the user in the form (no discard on outside click)
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onContinueEditing();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ucd-title"
        aria-describedby="ucd-description"
        className="w-full max-w-[420px] animate-[fadeScaleIn_150ms_ease-out] rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-6 shadow-[0_32px_64px_-20px_rgba(0,0,0,0.35)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle size={18} className="text-brand" />
          </span>
          <div>
            <h2
              id="ucd-title"
              className="text-base font-bold tracking-tight text-zinc-900 dark:text-foreground"
            >
              Descartar alteracoes?
            </h2>
            <p id="ucd-description" className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-muted">
              Voce possui informacoes preenchidas neste novo projeto. Se sair agora, os dados nao salvos serao perdidos.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={continueRef}
            type="button"
            onClick={onContinueEditing}
            className="rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel-soft px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Continuar editando
          </button>
          <button
            ref={discardRef}
            type="button"
            onClick={onConfirmDiscard}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7f090c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          >
            Descartar e sair
          </button>
        </div>
      </div>
    </div>
  );
}
