"use client";

import { useEffect, useRef } from "react";
import { Download, Loader2 } from "lucide-react";

type ExportConfirmDialogProps = {
  open: boolean;
  /** True enquanto a exportação está em andamento (mantém o loading e trava duplo clique). */
  exporting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

// Modal de confirmação exibido ANTES de exportar o CSV de projetos. A exportação
// pode conter dados comerciais/operacionais sensíveis, então exigimos confirmação
// explícita. Mesmo padrão de acessibilidade dos demais dialogs (foco inicial no
// Cancelar, trap de Tab, Escape fecha). Durante a exportação os botões ficam
// desabilitados para evitar duplo clique / múltiplas chamadas à API.
export function ExportConfirmDialog({ open, exporting = false, onCancel, onConfirm }: ExportConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (!exporting) onCancel();
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
  }, [open, onCancel, exporting]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/50 p-4">
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-confirm-title"
        aria-describedby="export-confirm-description"
        className="w-full max-w-[480px] animate-[fadeScaleIn_150ms_ease-out] rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-6 shadow-[0_32px_64px_-20px_rgba(0,0,0,0.35)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="mb-3 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300">
            <Download size={18} />
          </span>
          <div>
            <h2 id="export-confirm-title" className="text-lg font-bold text-zinc-900 dark:text-foreground">
              Confirmar exportação
            </h2>
            <p id="export-confirm-description" className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Você está prestes a exportar os dados dos projetos para um arquivo CSV. O arquivo pode conter
              informações comerciais e operacionais sensíveis. Deseja continuar?
            </p>
          </div>
        </header>

        <footer className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={exporting}
            className="rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel-soft px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {exporting ? "Gerando exportação..." : "Exportar CSV"}
          </button>
        </footer>
      </article>
    </div>
  );
}
