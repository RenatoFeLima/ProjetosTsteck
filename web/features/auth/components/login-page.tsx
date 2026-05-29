"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Lock, LogIn, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/features/user/hooks/use-current-user";

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

// ─── Login page ───────────────────────────────────────────────────────────────
export function LoginPage() {
  const router = useRouter();
  const { identify } = useCurrentUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });

  // Redirect if already authenticated
  useEffect(() => {
    try {
      const stored = localStorage.getItem("tsteck:current-user");
      if (stored) router.replace("/");
    } catch {
      // ignore in SSR
    }
  }, [router]);

  function clearFieldError(field: "email" | "password") {
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate(): boolean {
    const errors = { email: "", password: "" };
    if (!email.trim()) errors.email = "Informe seu usuário ou e-mail.";
    if (!password) errors.password = "Informe sua senha.";
    setFieldErrors(errors);
    return !errors.email && !errors.password;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);
    if (!validate()) return;

    setLoading(true);

    try {
      // Simulate authentication delay
      await new Promise((resolve) => setTimeout(resolve, 1200));

      // Derive display name from email/username
      const raw = email.trim();
      const displayName = raw.includes("@")
        ? raw
            .split("@")[0]
            .replace(/[._-]+/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase())
            .trim()
        : raw
            .replace(/[._-]+/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase())
            .trim();

      identify({ name: displayName || "Usuário TSTECK", role: "Admin" });
      router.push("/");
    } catch {
      setGlobalError("Não foi possível conectar. Tente novamente.");
      setLoading(false);
    }
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

            {/* ── Global error ── */}
            {globalError && (
              <div
                className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-100 dark:border-red-700/40 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-[13px] text-red-600 dark:text-red-300"
                role="alert"
                style={{ animation: "fadeScaleIn 180ms ease-out both" }}
              >
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                {globalError}
              </div>
            )}

            {/* ── Form ── */}
            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-4">
                {/* Email / username */}
                <InputField
                  id="login-email"
                  label="Usuário ou e-mail"
                  value={email}
                  onChange={(v) => { setEmail(v); clearFieldError("email"); }}
                  placeholder="usuario@tsteck.com"
                  icon={<User size={15} />}
                  error={fieldErrors.email}
                  disabled={loading}
                  autoComplete="email"
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
                      className="text-[12px] text-zinc-400 transition hover:text-brand"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <InputField
                    id="login-password"
                    label=""
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(v) => { setPassword(v); clearFieldError("password"); }}
                    placeholder="••••••••"
                    icon={<Lock size={15} />}
                    error={fieldErrors.password}
                    disabled={loading}
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
                </div>
              </div>

              {/* Remember me */}
              <label className="mt-4 flex cursor-pointer select-none items-center gap-2 text-[13px] text-zinc-500 dark:text-zinc-400">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-[15px] w-[15px] rounded border-zinc-300 accent-brand"
                  disabled={loading}
                />
                Manter conectado
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white transition-all duration-150",
                  loading
                    ? "cursor-not-allowed bg-brand/75"
                    : "bg-brand hover:bg-brand-dark active:scale-[0.99]",
                )}
              >
                {loading ? (
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

          {/* Version tag */}
          <p className="mt-4 text-center text-[11px] text-white/40">
            v1.0.0 — Pipeline de Projetos
          </p>
        </div>
      </div>
    </div>
  );
}
