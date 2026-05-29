"use client";

import { useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";

type MissingRequiredFieldsDialogProps = {
  open: boolean;
  fields: string[];
  onClose: () => void;
};

export function MissingRequiredFieldsDialog({ open, fields, onClose }: MissingRequiredFieldsDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="missing-required-title"
        aria-describedby="missing-required-description"
        className="w-full max-w-[480px] animate-[fadeScaleIn_150ms_ease-out] rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-6 shadow-[0_32px_64px_-20px_rgba(0,0,0,0.35)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="mb-3 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-brand">
            <AlertCircle size={18} />
          </span>
          <div>
            <h2 id="missing-required-title" className="text-lg font-bold text-zinc-900 dark:text-foreground">
              Campos obrigatorios pendentes
            </h2>
            <p id="missing-required-description" className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Preencha os campos abaixo para continuar com o salvamento do projeto.
            </p>
          </div>
        </header>

        <ul className="space-y-1 rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50/80 dark:bg-panel-soft p-3 text-sm text-zinc-800 dark:text-zinc-200">
          {fields.map((field) => (
            <li key={field} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              <span>{field}</span>
            </li>
          ))}
        </ul>

        <footer className="mt-4 flex justify-end">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#9e0b0f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7f090c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          >
            Entendi
          </button>
        </footer>
      </article>
    </div>
  );
}
