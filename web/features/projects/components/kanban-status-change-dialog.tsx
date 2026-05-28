"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const requiresNote = toStatus === "REVISAO DE ESTUDO";
  const noteValid = note.trim().length > 0;

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

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        resetState();
        onCancel();
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, requiresNote, onCancel]);

  const helper = useMemo(() => {
    if (!requiresNote) return "";
    if (!touched || noteValid) return "";
    return "Informe uma observacao para mover o projeto para Revisao de Estudo.";
  }, [requiresNote, touched, noteValid]);

  if (!open || !fromStatus || !toStatus || !projectCode) return null;

  return (
    <div
      className="fixed inset-0 z-[95] grid place-items-center bg-black/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleCancel();
      }}
    >
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="kanban-change-title"
        aria-describedby="kanban-change-description"
        className="w-full max-w-[620px] animate-[fadeScaleIn_150ms_ease-out] rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_32px_64px_-20px_rgba(0,0,0,0.35)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="mb-3 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
            <ArrowRightLeft size={18} />
          </span>
          <div>
            <h2 id="kanban-change-title" className="text-lg font-bold text-zinc-900">Confirmar mudanca de status?</h2>
            <p id="kanban-change-description" className="mt-1 text-sm text-zinc-600">
              Revise a transicao antes de confirmar. Essa alteracao sera registrada no historico operacional.
            </p>
          </div>
        </header>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
          <p>
            Projeto: <span className="font-mono font-semibold text-zinc-900">{projectCode}</span>
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
            <label htmlFor="kanban-note" className="mb-1 block text-sm font-semibold text-zinc-800">
              Observacao obrigatoria
            </label>
            <textarea
              id="kanban-note"
              ref={textareaRef}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="Descreva o motivo da revisao de estudo..."
              className={`min-h-24 w-full rounded-xl border bg-white p-3 text-sm outline-none transition ${
                helper ? "border-brand" : "border-zinc-300 focus:border-brand"
              }`}
            />
            {helper && <p className="mt-1 text-xs font-medium text-brand">{helper}</p>}
          </div>
        )}

        <footer className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={handleCancel}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Cancelar
          </button>
          <button
            ref={confirmRef}
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
            className="rounded-xl bg-[#9e0b0f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7f090c] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          >
            Confirmar mudanca
          </button>
        </footer>
      </article>
    </div>
  );
}
