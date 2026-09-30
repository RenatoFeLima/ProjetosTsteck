"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, Undo2 } from "lucide-react";
import type { Project, ProjectStatus } from "@/features/projects/domain/project-types";
import { hasDevelopmentSla } from "@/features/projects/domain/project-rules";
import {
  getRegressionTargets,
  normalizeRegressionReason,
  regressionResetsAlignment,
  REGRESSION_REASON_MAX,
  REGRESSION_REASON_MIN,
} from "@/features/projects/domain/status-regression";

export type RegressionSubmitResult = { ok: boolean; error?: string };

type Props = {
  project: Project;
  onCancel: () => void;
  /** Executa a regressão no servidor. Em sucesso quem abriu fecha o modal; em erro ele continua aberto. */
  onSubmit: (toStatus: ProjectStatus, reason: string) => Promise<RegressionSubmitResult>;
};

const FAILURE_MESSAGE = "Não foi possível regredir o status do projeto. Nenhuma alteração foi realizada. Tente novamente.";

const FOCUSABLE = "button:not([disabled]), select:not([disabled]), textarea:not([disabled])";

/**
 * Regressão administrativa de status (somente ADMIN) em duas etapas: escolha do
 * destino + motivo, depois confirmação explícita. Montado só enquanto aberto.
 * Nada muda na tela antes da resposta do servidor.
 */
export function AdminStatusRegressionDialog({ project, onCancel, onSubmit }: Props) {
  const targets = getRegressionTargets(project.status_atual);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [target, setTarget] = useState<ProjectStatus | "">("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ detail?: string } | null>(null);
  // Trava SÍNCRONA contra duplo clique (o estado do React só chega no próximo render).
  const submittingRef = useRef(false);
  const dialogRef = useRef<HTMLElement>(null);

  const reasonCheck = normalizeRegressionReason(reason);
  const canContinue = Boolean(target) && reasonCheck.ok;
  const resetsAlignment = target !== "" && regressionResetsAlignment(target);
  const restartsSla = target !== "" && hasDevelopmentSla(target);

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, [step]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (!submittingRef.current) onCancel();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onCancel]);

  async function confirm() {
    if (submittingRef.current || !target || !reasonCheck.ok) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    let result: RegressionSubmitResult;
    try {
      result = await onSubmit(target, reasonCheck.reason);
    } catch {
      result = { ok: false };
    }
    if (!result.ok) {
      setError({ detail: result.error });
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const buttonBase = "rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2";
  const secondary = `${buttonBase} border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel-soft text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/8 focus-visible:ring-zinc-400`;
  const danger = `${buttonBase} bg-[#9e0b0f] text-white hover:bg-[#7f090c] focus-visible:ring-brand/50`;

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center overflow-y-auto bg-black/50 p-4">
      <article
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-regression-title"
        data-testid="admin-status-regression-dialog"
        className="w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-5 shadow-[0_32px_64px_-20px_rgba(0,0,0,0.35)] sm:p-6"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {step === "form" ? (
          <>
            <header className="mb-3 flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20 text-brand">
                <Undo2 size={18} />
              </span>
              <div>
                <h2 id="admin-regression-title" className="text-lg font-bold text-zinc-900 dark:text-foreground">
                  Regredir status do projeto
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Esta é uma ação administrativa.</p>
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
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Regredir para</span>
                <select
                  value={target}
                  onChange={(event) => setTarget(event.target.value as ProjectStatus | "")}
                  className="h-10 w-full rounded-lg border border-zinc-300 dark:border-white/8 bg-white dark:bg-panel-soft dark:text-foreground px-3 text-sm"
                >
                  <option value="">Selecione...</option>
                  {targets.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="mt-3 block">
              <span className="mb-1 flex items-baseline justify-between text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                <span>
                  Motivo da regressão <span className="text-[#9e0b0f]">*</span>
                </span>
                <span className="font-normal normal-case tracking-normal text-zinc-400">
                  {reason.trim().length}/{REGRESSION_REASON_MAX}
                </span>
              </span>
              <textarea
                value={reason}
                maxLength={REGRESSION_REASON_MAX}
                onChange={(event) => setReason(event.target.value)}
                onBlur={() => setTouched(true)}
                className="min-h-24 w-full rounded-xl border border-zinc-300 dark:border-white/8 bg-white dark:bg-panel-soft dark:text-foreground dark:placeholder:text-zinc-600 p-3 text-sm outline-none transition focus:border-brand"
                placeholder="Ex.: Cliente solicitou revisão do ante-projeto após aprovação."
              />
            </label>
            {touched && !reasonCheck.ok && (
              <p className="mt-1 text-xs font-medium text-brand">Informe ao menos {REGRESSION_REASON_MIN} caracteres.</p>
            )}

            <div className="mt-3 space-y-1.5 rounded-xl border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/15 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              <p className="flex items-start gap-2">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>A regressão altera a etapa operacional do projeto e poderá impactar o fluxo operacional.</span>
              </p>
              {resetsAlignment && (
                <p className="pl-6">O alinhamento será marcado como pendente novamente e deverá ser concluído antes de o projeto avançar.</p>
              )}
              {restartsSla && (
                <p className="pl-6">
                  O prazo desta etapa será contado novamente a partir desta regressão, respeitando eventuais prazos explícitos já cadastrados.
                </p>
              )}
            </div>

            <footer className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={onCancel} className={secondary}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={!canContinue}
                onClick={() => {
                  if (!canContinue) {
                    setTouched(true);
                    return;
                  }
                  setStep("confirm");
                }}
                className={danger}
              >
                Continuar
              </button>
            </footer>
          </>
        ) : (
          <>
            <header className="mb-3 flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20 text-brand">
                <AlertTriangle size={18} />
              </span>
              <div>
                <h2 id="admin-regression-title" className="text-lg font-bold text-zinc-900 dark:text-foreground">
                  Confirmar regressão de status?
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Você está prestes a regredir:</p>
              </div>
            </header>

            <div className="space-y-2 rounded-xl border border-red-200 dark:border-red-700/40 bg-red-50/60 dark:bg-red-900/15 p-3 text-sm">
              <p className="font-mono font-semibold text-zinc-900 dark:text-foreground">{project.codigo_projeto}</p>
              <div className="flex flex-col items-start gap-1" data-testid="admin-regression-summary">
                <span>
                  De: <span className="font-semibold text-zinc-900 dark:text-foreground">{project.status_atual}</span>
                </span>
                <ArrowDown size={14} className="text-zinc-500" aria-hidden="true" />
                <span>
                  Para: <span className="font-semibold text-zinc-900 dark:text-foreground">{target}</span>
                </span>
              </div>
              <p className="break-words">
                Motivo: <span className="text-zinc-900 dark:text-foreground">{reasonCheck.ok ? reasonCheck.reason : ""}</span>
              </p>
              {resetsAlignment && <p>O alinhamento será marcado como pendente novamente.</p>}
            </div>

            <p className="mt-3 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>Esta ação será registrada no histórico e na auditoria.</span>
            </p>

            {error && (
              <div role="alert" className="mt-3 rounded-xl border border-red-200 dark:border-red-700/50 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                <p className="font-semibold">{FAILURE_MESSAGE}</p>
                {error.detail && <p className="mt-1 text-xs">{error.detail}</p>}
              </div>
            )}

            <footer className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" disabled={submitting} onClick={onCancel} className={secondary}>
                Cancelar
              </button>
              <button type="button" disabled={submitting} onClick={() => setStep("form")} className={secondary}>
                Voltar
              </button>
              <button type="button" disabled={submitting} onClick={() => void confirm()} className={danger}>
                {submitting ? "Regredindo..." : "Sim, regredir status"}
              </button>
            </footer>
          </>
        )}
      </article>
    </div>
  );
}
