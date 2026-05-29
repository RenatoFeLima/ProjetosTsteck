"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRightLeft } from "lucide-react";
import type { ProjectStatus } from "@/features/projects/domain/project-types";

type KanbanStatusChangeDialogProps = {
  open: boolean;
  projectCode?: string;
  fromStatus?: ProjectStatus;
  toStatus?: ProjectStatus;
  onCancel: () => void;
  onConfirm: (observation?: string) => void;
};

export function KanbanStatusChangeDialog({
  open,
  projectCode,
  fromStatus,
  toStatus,
  onCancel,
  onConfirm,
}: KanbanStatusChangeDialogProps) {
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const requiresNote = toStatus === "REVISAO DE ESTUDO";
  const noteValid = note.trim().length > 0;

  // Needed to avoid SSR mismatch — createPortal requires document
  useEffect(() => {
    setIsMounted(true);
  }, []);

  function resetState() {
    setNote("");
    setTouched(false);
  }

  function handleCancel() {
    resetState();
    onCancel();
  }

  useEffect(() => {
    if (!open) return;

    window.requestAnimationFrame(() => {
      if (requiresNote) {
        textareaRef.current?.focus();
      } else {
        cancelRef.current?.focus();
      }
    });

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        resetState();
        onCancel();
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, requiresNote, onCancel]);

  const helper = useMemo(() => {
    if (!requiresNote || !touched || noteValid) return "";
    return "Informe uma observacao para mover o projeto para Revisao de Estudo.";
  }, [requiresNote, touched, noteValid]);

  if (!isMounted || !open || !fromStatus || !toStatus || !projectCode) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="kanban-change-title"
        aria-describedby="kanban-change-description"
        className="w-full max-w-[620px] animate-[fadeScaleIn_150ms_ease-out] rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-6 shadow-[0_32px_64px_-20px_rgba(0,0,0,0.35)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="mb-3 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-white/8 text-zinc-700 dark:text-zinc-300">
            <ArrowRightLeft size={18} />
          </span>
          <div>
            <h2 id="kanban-change-title" className="text-lg font-bold text-zinc-900 dark:text-foreground">
              Confirmar alteracao de status?
            </h2>
            <p id="kanban-change-description" className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Voce esta movendo o projeto para{" "}
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{toStatus}</span>. Confirme para
              aplicar a alteracao.
            </p>
          </div>
        </header>

        <div className="rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft p-3 text-sm text-zinc-700 dark:text-zinc-300">
          <p>
            Projeto:{" "}
            <span className="font-mono font-semibold text-zinc-900 dark:text-foreground">{projectCode}</span>
          </p>
          <p className="mt-1">
            <span className="font-semibold">De:</span> {fromStatus}
          </p>
          <p>
            <span className="font-semibold">Para:</span> {toStatus}
          </p>
        </div>

        {requiresNote && (
          <div className="mt-4">
            <label htmlFor="kanban-note" className="mb-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Observacao obrigatoria
            </label>
            <textarea
              id="kanban-note"
              ref={textareaRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="Descreva o motivo da revisao de estudo..."
              className={[
                "min-h-24 w-full rounded-xl border bg-white dark:bg-panel-soft dark:text-foreground dark:placeholder:text-zinc-600 p-3 text-sm outline-none transition",
                helper
                  ? "border-[#9e0b0f] focus:border-[#9e0b0f]"
                  : "border-zinc-300 dark:border-white/8 focus:border-[#9e0b0f]",
              ].join(" ")}
            />
            {helper && (
              <p className="mt-1 text-xs font-medium text-[#9e0b0f]">{helper}</p>
            )}
          </div>
        )}

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
            type="button"
            disabled={requiresNote && !noteValid}
            onClick={() => {
              if (requiresNote && !noteValid) {
                setTouched(true);
                return;
              }
              onConfirm(note.trim() || undefined);
              resetState();
            }}
            className="rounded-xl bg-[#9e0b0f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7f090c] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e0b0f]/50"
          >
            Confirmar alteracao
          </button>
        </footer>
      </article>
    </div>,
    document.body,
  );
}
