"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Hash } from "lucide-react";
import { apiGetNextCodeSuggestion } from "@/features/projects/lib/projects-api";
import { extractCodePrefix, hasValidFinalCode } from "@/features/projects/domain/project-code";

type Props = {
  open: boolean;
  currentCode?: string;
  ignoreId?: string;
  isCodigoDuplicado: (codigo: string, ignoreId?: string) => boolean;
  onConfirm: (finalCode: string) => void;
  onCancel: () => void;
};

/** Modal exibido ao mover um projeto para "Ante-Projeto Enviado": confirma/edita
 *  o código do projeto, com sugestão automática baseada no último código registrado. */
export function FinalCodeDialog({ open, currentCode, ignoreId, isCodigoDuplicado, onConfirm, onCancel }: Props) {
  const [code, setCode] = useState("");
  // Referência "De:": código do último projeto que chegou em PROJETO APROVADO (terminal).
  const [lastFinalCode, setLastFinalCode] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !currentCode) return;
    let active = true;
    setTouched(false);
    setLoading(true);
    setCode(currentCode);
    setLastFinalCode(null);
    apiGetNextCodeSuggestion(currentCode)
      .then((r) => {
        if (!active) return;
        setLastFinalCode(r.lastFinalCode);
        if (r.suggestedFinalCode) {
          setCode(r.suggestedFinalCode);
        } else {
          const prefix = extractCodePrefix(currentCode);
          setCode(prefix ? `${prefix}-${r.nextSuffix}` : r.nextSuffix);
        }
      })
      .catch(() => {
        if (active) setCode(currentCode);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          window.requestAnimationFrame(() => inputRef.current?.focus());
        }
      });
    return () => {
      active = false;
    };
  }, [open, currentCode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onCancel]);

  if (!mounted || !open || !currentCode) return null;

  const trimmed = code.trim();
  // "De:" mostra o último finalizado; cai para o provisório atual se não houver.
  const fromCode = lastFinalCode ?? currentCode;
  const formatErr = trimmed && !hasValidFinalCode(trimmed) ? "O código deve terminar com 4 dígitos numéricos." : "";
  const dupErr =
    trimmed && trimmed !== currentCode && isCodigoDuplicado(trimmed, ignoreId)
      ? "Já existe um projeto com este código."
      : "";
  const error = formatErr || dupErr;
  const canConfirm = Boolean(trimmed) && !error && !loading;

  return createPortal(
    <div
      data-testid="final-code-dialog"
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/50 p-4"
    >
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="final-code-title"
        className="w-full max-w-[560px] animate-[fadeScaleIn_150ms_ease-out] rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-6 shadow-[0_32px_64px_-20px_rgba(0,0,0,0.35)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="mb-3 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-white/8 text-zinc-700 dark:text-zinc-300">
            <Hash size={18} />
          </span>
          <div>
            <h2 id="final-code-title" className="text-lg font-bold text-zinc-900 dark:text-foreground">
              Confirmar o código do projeto
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Ao enviar o ante-projeto, o código provisório pode ser atualizado. Confirme ou edite a sugestão.
            </p>
          </div>
        </header>

        <div className="rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft p-3 text-sm text-zinc-700 dark:text-zinc-300">
          <p>
            De:{" "}
            <span className="font-mono font-semibold text-zinc-900 dark:text-foreground">
              {loading ? "…" : fromCode}
            </span>
          </p>
          {currentCode && currentCode !== fromCode && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Código provisório atual:{" "}
              <span className="font-mono text-zinc-600 dark:text-zinc-300">{currentCode}</span>
            </p>
          )}
        </div>

        <div className="mt-4">
          <label htmlFor="final-code-input" className="mb-1 block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Código final {loading && <span className="text-xs font-normal text-zinc-400">(carregando sugestão…)</span>}
          </label>
          <input
            id="final-code-input"
            ref={inputRef}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setTouched(true);
            }}
            onBlur={() => setTouched(true)}
            className={[
              "w-full rounded-xl border bg-white dark:bg-panel-soft dark:text-foreground px-3 py-2.5 font-mono text-sm outline-none transition",
              error && touched
                ? "border-[#9e0b0f] focus:border-[#9e0b0f]"
                : "border-zinc-300 dark:border-white/8 focus:border-[#9e0b0f]",
            ].join(" ")}
          />
          {error && touched && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#9e0b0f]">
              <AlertCircle size={11} />
              {error}
            </p>
          )}
        </div>

        <footer className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel-soft px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-white/8"
          >
            Cancelar movimentação
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => {
              if (!canConfirm) {
                setTouched(true);
                return;
              }
              onConfirm(trimmed);
            }}
            className="rounded-xl bg-[#9e0b0f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7f090c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Confirmar
          </button>
        </footer>
      </article>
    </div>,
    document.body,
  );
}
