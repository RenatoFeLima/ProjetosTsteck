"use client";

// Componente ÚNICO de mensagem de erro da aplicação.
//
// Recebe um FriendlyError já traduzido pelo catálogo (lib/errors/error-catalog)
// — nunca um código técnico cru. Nenhuma tela deve montar a própria caixinha de
// erro: use este componente para manter texto, cor, ícone e acessibilidade
// consistentes.
//
// Acessibilidade: role="alert" + ícone + título + texto. A severidade NUNCA é
// comunicada só por cor.

import { AlertCircle, AlertTriangle, Lock, RefreshCw, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRetryDuration, type FriendlyError } from "@/lib/errors/error-catalog";

type Severity = FriendlyError["severity"];

const TONE: Record<Severity, string> = {
  info: "border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-white/5 text-zinc-700 dark:text-zinc-200",
  warning:
    "border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200",
  critical:
    "border-red-200 dark:border-red-700/40 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-200",
};

/** Retorna o ELEMENTO do ícone (não o componente): atribuir um componente a uma
 *  variável durante o render reinicia o estado dele a cada render. */
function renderIcon(error: FriendlyError) {
  const props = { size: 15, className: "mt-0.5 flex-shrink-0", "aria-hidden": true } as const;
  if (error.code === "RATE_LIMIT") return <Lock {...props} />;
  if (error.code === "NETWORK_ERROR") return <WifiOff {...props} />;
  return error.severity === "critical" ? (
    <AlertTriangle {...props} />
  ) : (
    <AlertCircle {...props} />
  );
}

export type AppErrorMessageProps = {
  error: FriendlyError;
  /** Segundos restantes de bloqueio (429). Quando > 0, exibe o contador. */
  countdownSeconds?: number;
  /** Handler do botão de ação. Só é renderizado quando o erro é "retryable". */
  onRetry?: () => void;
  className?: string;
};

export function AppErrorMessage({
  error,
  countdownSeconds = 0,
  onRetry,
  className,
}: AppErrorMessageProps) {
  const showCountdown = countdownSeconds > 0;
  // Enquanto houver bloqueio ativo não oferecemos "Tentar novamente":
  // insistir só gera requisição inútil.
  const showRetry = error.retryable && !!onRetry && !showCountdown;

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[13px]",
        TONE[error.severity],
        className,
      )}
      style={{ animation: "fadeScaleIn 180ms ease-out both" }}
    >
      {renderIcon(error)}

      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug">{error.title}</p>
        <p className="mt-1 leading-relaxed opacity-90">{error.description}</p>

        {showCountdown && (
          <p className="mt-2 font-medium tabular-nums" aria-live="polite">
            Tente novamente em {formatRetryDuration(countdownSeconds)}.
          </p>
        )}

        {showRetry && (
          <button
            type="button"
            onClick={onRetry}
            className={cn(
              "mt-3 inline-flex items-center gap-1.5 rounded-lg border border-current/25 px-3 py-1.5",
              "text-[12px] font-semibold transition hover:bg-current/10",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-current/40",
            )}
          >
            <RefreshCw size={12} aria-hidden="true" />
            {error.actionLabel ?? "Tentar novamente"}
          </button>
        )}

      </div>
    </div>
  );
}
