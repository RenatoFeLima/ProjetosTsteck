"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, Eye, EyeOff, Lock, LogIn, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { AppErrorMessage } from "@/features/ui/app-error-message";
import { useCountdown } from "@/features/ui/use-countdown";
import {
  formatCountdown,
  getUserFriendlyError,
  type FriendlyError,
} from "@/lib/errors/error-catalog";

// ─── Input field ──────────────────────────────────────────────────────────────
type InputFieldProps = {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon: React.ReactNode;
  error?: string;
  disabled?: boolean;
  suffix?: React.ReactNode;
  autoComplete?: string;
  inputRef?: React.Ref<HTMLInputElement>;
};

function InputField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  icon,
  error,
  disabled,
  suffix,
  autoComplete,
  inputRef,
}: InputFieldProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
      )}
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
          {icon}
        </span>
        <input
          ref={inputRef}
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          className={cn(
            "h-[52px] w-full rounded-xl border bg-white dark:bg-panel-soft pl-10 text-[14px] text-zinc-900 dark:text-foreground outline-none transition-all duration-150 placeholder:text-zinc-300 dark:placeholder:text-zinc-600",
            suffix ? "pr-10" : "pr-4",
            error
              ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100"
              : "border-zinc-200 dark:border-white/10 focus:border-brand focus:ring-2 focus:ring-brand/10",
            disabled && "cursor-not-allowed opacity-60",
          )}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</span>
        )}
      </div>
      {error && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-red-500">
          <AlertCircle size={11} className="flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

/** Mesma normalização do backend (buildCredentialIdentifier), para sabermos a
 *  qual usuário o bloqueio de credencial se aplica. */
function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

// ─── Login page ───────────────────────────────────────────────────────────────
export function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  /** Epoch (ms) até quando o rate limit bloqueia. Só UX — o backend decide. */
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  /** Segundos informados pelo backend — usados até o contador sincronizar. */
  const [blockedSeconds, setBlockedSeconds] = useState(0);
  /** Username (normalizado) que recebeu o 429. O bloqueio do nível de
   *  credencial é por IP+username, então trocar de usuário deve liberar. */
  const [blockedUsername, setBlockedUsername] = useState<string | null>(null);
  /** 503 ativo: impede o submit normal de martelar o servidor caído. */
  const [serviceDown, setServiceDown] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ username: "", password: "" });
  const [forgotMsg, setForgotMsg] = useState(false);

  const passwordRef = useRef<HTMLInputElement>(null);

  const secondsLeft = useCountdown(blockedUntil, blockedSeconds);
  // Bloqueio só vale para o MESMO username que o backend bloqueou.
  const isRateLimited =
    secondsLeft > 0 && blockedUsername !== null && normalizeUsername(username) === blockedUsername;
  const submitBlocked = loading || isRateLimited || serviceDown;

  function clearFieldError(field: "username" | "password") {
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: "" }));
  }

  /** Trocar o username remove o bloqueio VISUAL do usuário anterior. O limite
   *  no servidor continua valendo — aqui só deixamos de exibir o alerta. */
  function handleUsernameChange(value: string) {
    setUsername(value);
    clearFieldError("username");
    if (error?.code === "RATE_LIMIT" && normalizeUsername(value) !== blockedUsername) {
      setError(null);
    }
  }

  function validate(): boolean {
    const errors = { username: "", password: "" };
    if (!username.trim()) errors.username = "Informe seu usuário.";
    if (!password) errors.password = "Informe sua senha.";
    setFieldErrors(errors);
    return !errors.username && !errors.password;
  }

  // Uma única tentativa por chamada — usada tanto pelo submit quanto pelo
  // "Tentar novamente" do 503. Nunca dispara em paralelo nem em loop.
  const attemptLogin = useCallback(async () => {
    setLoading(true);
    setError(null);
    setServiceDown(false);
    try {
      const result = await login(username.trim(), password);
      if (result.ok) {
        router.push(result.mustChangePassword ? "/change-password" : "/");
        return;
      }

      const friendly = getUserFriendlyError(result.code, {
        status: result.status,
        fallbackMessage: result.message,
        requestId: result.requestId,
        retryAfterSeconds: result.retryAfterSeconds,
        surface: "login",
      });
      setError(friendly);

      // Qualquer estado de erro re-mascara a senha: ela nunca fica à mostra
      // depois de uma resposta de falha.
      setShowPassword(false);

      if (friendly.code === "RATE_LIMIT" && friendly.retryAfterSeconds) {
        setBlockedUntil(Date.now() + friendly.retryAfterSeconds * 1000);
        setBlockedSeconds(friendly.retryAfterSeconds);
        setBlockedUsername(normalizeUsername(username));
      } else {
        setBlockedUntil(null);
        setBlockedSeconds(0);
        setBlockedUsername(null);
      }

      setServiceDown(friendly.code === "SERVICE_UNAVAILABLE");

      // Credencial inválida: limpa só a senha e devolve o foco para ela.
      if (friendly.code === "INVALID_CREDENTIALS") {
        setPassword("");
        passwordRef.current?.focus();
      }
    } catch {
      setShowPassword(false);
      setError(getUserFriendlyError("INTERNAL_ERROR", { surface: "login" }));
    } finally {
      setLoading(false);
    }
  }, [login, password, router, username]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Bloqueado, serviço fora ou já em voo: não envia nada — evita spam de POST.
    if (submitBlocked) return;
    setError(null);
    if (!validate()) return;
    await attemptLogin();
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* ── Full-screen background image ── */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Login.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full select-none pointer-events-none object-cover object-[35%_center]"
      />

      {/* ── Base dark overlay ── */}
      <div className="absolute inset-0 bg-black/25" />

      {/* ── Right-side gradient — boosts contrast behind the card ── */}
      <div className="absolute inset-y-0 right-0 hidden w-[58%] bg-gradient-to-l from-black/55 via-black/25 to-transparent lg:block" />

      {/* ── Bottom vignette ── */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/45 to-transparent" />

      {/* ── Main layout ── */}
      <div className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center p-6 lg:flex-row lg:items-center lg:justify-end lg:pr-[9vw] xl:pr-[11vw]">

        {/* ── Login card ── */}
        <div
          className="w-full max-w-[440px]"
          style={{ animation: "fadeScaleIn 340ms cubic-bezier(0.22,1,0.36,1) both" }}
        >
          <div
            className="rounded-3xl border px-8 py-8 shadow-[0_32px_80px_rgba(0,0,0,0.45),0_4px_20px_rgba(0,0,0,0.28)]"
            style={{
              background: "var(--glass-bg)",
              borderColor: "var(--glass-border)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            {/* ── Card header ── */}
            <div className="mb-7">
              <div className="mb-4 flex items-baseline gap-3">
                <span
                  className="text-[1.4rem] font-bold tracking-[0.22em] text-brand"
                  style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}
                >
                  TSTECK
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                  Engenharia Operacional
                </span>
              </div>
              <div className="mb-4 h-[2px] w-10 rounded-full bg-brand" />
              <h1 className="text-[1.2rem] font-semibold tracking-tight text-zinc-900 dark:text-foreground">
                Acessar sistema
              </h1>
              <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400 dark:text-zinc-500">
                Entre com suas credenciais para acessar o Pipeline de Projetos.
              </p>
            </div>

            {/* ── Global error (componente único do design system) ── */}
            {error && (
              <AppErrorMessage
                error={error}
                countdownSeconds={secondsLeft}
                onRetry={attemptLogin}
                className="mb-5"
              />
            )}

            {/* ── Form ── */}
            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-4">
                {/* Username */}
                <InputField
                  id="login-username"
                  label="Usuário"
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="Ex.: JoaoSilva"
                  icon={<User size={15} />}
                  error={fieldErrors.username}
                  // Os campos NUNCA são desabilitados: o limite de credencial é
                  // por IP+username, então o usuário precisa poder corrigir o
                  // nome durante um bloqueio. Quem impede o envio é o botão.
                  autoComplete="username"
                />

                {/* Password */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label
                      htmlFor="login-password"
                      className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => setForgotMsg((s) => !s)}
                      className="text-[12px] text-zinc-400 transition hover:text-brand"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <InputField
                    id="login-password"
                    label=""
                    inputRef={passwordRef}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(v) => { setPassword(v); clearFieldError("password"); }}
                    placeholder="••••••••"
                    icon={<Lock size={15} />}
                    error={fieldErrors.password}
                    autoComplete="current-password"
                    suffix={
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        tabIndex={-1}
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        className="text-zinc-400 transition hover:text-zinc-600"
                      >
                        {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    }
                  />
                  {forgotMsg && (
                    <p className="mt-2 rounded-xl border border-amber-100 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5 text-[12px] text-amber-700 dark:text-amber-300" role="status">
                      Solicite ao administrador do sistema a redefinição da sua senha.
                    </p>
                  )}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitBlocked}
                className={cn(
                  "mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white transition-all duration-150",
                  submitBlocked
                    ? "cursor-not-allowed bg-brand/75"
                    : "bg-brand hover:bg-brand-dark active:scale-[0.99]",
                )}
              >
                {isRateLimited ? (
                  <>
                    <Lock size={15} aria-hidden="true" />
                    <span className="tabular-nums">
                      Aguarde {formatCountdown(secondsLeft)}
                    </span>
                  </>
                ) : serviceDown ? (
                  <>
                    <AlertTriangle size={15} aria-hidden="true" />
                    Serviço indisponível
                  </>
                ) : loading ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                      <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Entrando...
                  </>
                ) : (
                  <>
                    <LogIn size={15} />
                    Entrar
                  </>
                )}
              </button>
            </form>

            {/* ── Card footer ── */}
            <p className="mt-6 text-center text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
              Acesso restrito aos usuários autorizados.
              <br />
              Ambiente interno TSTECK. O acesso é monitorado.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
