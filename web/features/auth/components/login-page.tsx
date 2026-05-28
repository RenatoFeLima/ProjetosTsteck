"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Lock, LogIn, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/features/user/hooks/use-current-user";

// ─── SVG: Engineering schematic decoration ───────────────────────────────────
function TechnicalDecoration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 520"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Outer boundary */}
      <rect x="60" y="60" width="400" height="400" stroke="rgb(158 11 15 / 0.09)" strokeWidth="1" />
      {/* Inner rectangle */}
      <rect x="130" y="130" width="260" height="260" stroke="rgb(158 11 15 / 0.07)" strokeWidth="0.75" />
      {/* Cross hairlines */}
      <line x1="60" y1="260" x2="460" y2="260" stroke="rgb(158 11 15 / 0.07)" strokeWidth="0.5" />
      <line x1="260" y1="60" x2="260" y2="460" stroke="rgb(158 11 15 / 0.07)" strokeWidth="0.5" />
      {/* Outer stub lines */}
      <line x1="60" y1="160" x2="130" y2="160" stroke="rgb(158 11 15 / 0.06)" strokeWidth="0.5" />
      <line x1="390" y1="160" x2="460" y2="160" stroke="rgb(158 11 15 / 0.06)" strokeWidth="0.5" />
      <line x1="60" y1="360" x2="130" y2="360" stroke="rgb(158 11 15 / 0.06)" strokeWidth="0.5" />
      <line x1="390" y1="360" x2="460" y2="360" stroke="rgb(158 11 15 / 0.06)" strokeWidth="0.5" />
      <line x1="160" y1="60" x2="160" y2="130" stroke="rgb(158 11 15 / 0.06)" strokeWidth="0.5" />
      <line x1="160" y1="390" x2="160" y2="460" stroke="rgb(158 11 15 / 0.06)" strokeWidth="0.5" />
      <line x1="360" y1="60" x2="360" y2="130" stroke="rgb(158 11 15 / 0.06)" strokeWidth="0.5" />
      <line x1="360" y1="390" x2="360" y2="460" stroke="rgb(158 11 15 / 0.06)" strokeWidth="0.5" />
      {/* Corner brackets */}
      <path d="M60 96 L60 60 L96 60" stroke="rgb(158 11 15 / 0.22)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M424 60 L460 60 L460 96" stroke="rgb(158 11 15 / 0.22)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M60 424 L60 460 L96 460" stroke="rgb(158 11 15 / 0.22)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M424 460 L460 460 L460 424" stroke="rgb(158 11 15 / 0.22)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Inner corner markers */}
      <path d="M130 150 L130 130 L150 130" stroke="rgb(158 11 15 / 0.14)" strokeWidth="0.75" fill="none" strokeLinecap="round" />
      <path d="M370 130 L390 130 L390 150" stroke="rgb(158 11 15 / 0.14)" strokeWidth="0.75" fill="none" strokeLinecap="round" />
      <path d="M130 370 L130 390 L150 390" stroke="rgb(158 11 15 / 0.14)" strokeWidth="0.75" fill="none" strokeLinecap="round" />
      <path d="M370 390 L390 390 L390 370" stroke="rgb(158 11 15 / 0.14)" strokeWidth="0.75" fill="none" strokeLinecap="round" />
      {/* Quadrant intersection circles */}
      <circle cx="160" cy="160" r="5" stroke="rgb(158 11 15 / 0.16)" strokeWidth="0.75" />
      <circle cx="360" cy="160" r="5" stroke="rgb(158 11 15 / 0.16)" strokeWidth="0.75" />
      <circle cx="160" cy="360" r="5" stroke="rgb(158 11 15 / 0.16)" strokeWidth="0.75" />
      <circle cx="360" cy="360" r="5" stroke="rgb(158 11 15 / 0.16)" strokeWidth="0.75" />
      {/* Center accent */}
      <circle cx="260" cy="260" r="9" stroke="rgb(158 11 15 / 0.22)" strokeWidth="1" />
      <circle cx="260" cy="260" r="3" fill="rgb(158 11 15 / 0.35)" />
      {/* Center crosshair */}
      <line x1="248" y1="260" x2="272" y2="260" stroke="rgb(158 11 15 / 0.18)" strokeWidth="0.5" />
      <line x1="260" y1="248" x2="260" y2="272" stroke="rgb(158 11 15 / 0.18)" strokeWidth="0.5" />
      {/* Inner cross grid */}
      <line x1="130" y1="260" x2="390" y2="260" stroke="rgb(158 11 15 / 0.05)" strokeWidth="0.5" />
      <line x1="260" y1="130" x2="260" y2="390" stroke="rgb(158 11 15 / 0.05)" strokeWidth="0.5" />
      {/* Diagonal accent lines */}
      <line x1="260" y1="260" x2="160" y2="160" stroke="rgb(158 11 15 / 0.05)" strokeWidth="0.5" />
      <line x1="260" y1="260" x2="360" y2="160" stroke="rgb(158 11 15 / 0.05)" strokeWidth="0.5" />
      <line x1="260" y1="260" x2="160" y2="360" stroke="rgb(158 11 15 / 0.05)" strokeWidth="0.5" />
      <line x1="260" y1="260" x2="360" y2="360" stroke="rgb(158 11 15 / 0.05)" strokeWidth="0.5" />
      {/* Dimension line */}
      <line x1="34" y1="60" x2="34" y2="460" stroke="rgb(158 11 15 / 0.09)" strokeWidth="0.5" />
      <line x1="28" y1="60" x2="40" y2="60" stroke="rgb(158 11 15 / 0.09)" strokeWidth="0.5" />
      <line x1="28" y1="460" x2="40" y2="460" stroke="rgb(158 11 15 / 0.09)" strokeWidth="0.5" />
    </svg>
  );
}

// ─── Brand panel (left side) ──────────────────────────────────────────────────
function BrandPanel() {
  return (
    <div className="hidden lg:flex lg:w-[52%] xl:w-1/2 relative flex-col overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-[#fff9f9] to-[#f5f6f8]" />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(158, 11, 15, 0.032) 1px, transparent 1px),
            linear-gradient(90deg, rgba(158, 11, 15, 0.032) 1px, transparent 1px)
          `,
          backgroundSize: "44px 44px",
        }}
      />

      {/* Radial fade to soften the grid in the center */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_70%_at_45%_50%,rgba(255,255,255,0.9)_0%,transparent_100%)]" />

      {/* Red glow accent top-right */}
      <div className="absolute -top-24 right-0 h-80 w-72 rounded-full bg-brand/[0.06] blur-[90px]" />

      {/* Technical schematic SVG */}
      <TechnicalDecoration className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[28%] h-[560px] w-[560px]" />

      {/* Foreground content */}
      <div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-16">
        {/* Wordmark */}
        <div className="flex items-baseline gap-3">
          <span
            className="text-[1.55rem] font-bold leading-none tracking-[0.22em] text-brand"
            style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}
          >
            TSTECK
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Engenharia Operacional
          </span>
        </div>

        {/* Main tagline block */}
        <div>
          <div className="mb-5 h-[2px] w-10 rounded-full bg-brand" />
          <h2 className="text-[2.25rem] xl:text-[2.6rem] font-bold leading-[1.15] tracking-tight text-zinc-900">
            Controle inteligente<br />
            de projetos,<br />
            <span className="text-brand">prazos</span> e produtividade.
          </h2>
          <p className="mt-5 max-w-[300px] text-[13.5px] leading-relaxed text-zinc-500">
            Sistema operacional interno para gestão de projetos de engenharia com rastreabilidade completa.
          </p>
          <ul className="mt-6 space-y-2.5">
            {[
              "Controle de status e prazos",
              "Histórico completo de projetos",
              "KPIs e indicadores em tempo real",
              "Gestão de cadastros mestres",
            ].map((feat) => (
              <li key={feat} className="flex items-center gap-2.5 text-[12.5px] text-zinc-400">
                <span className="h-1 w-1 flex-shrink-0 rounded-full bg-brand/50" />
                {feat}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 text-[11px] text-zinc-400">
          <span>Pipeline de Projetos</span>
          <span className="h-px w-5 bg-zinc-300" />
          <span>v1.0.0</span>
        </div>
      </div>
    </div>
  );
}

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
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-zinc-700">
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
            "h-11 w-full rounded-xl border bg-white pl-10 text-[14px] text-zinc-900 outline-none transition-all duration-150 placeholder:text-zinc-300",
            suffix ? "pr-10" : "pr-4",
            error
              ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100"
              : "border-zinc-200 focus:border-brand focus:ring-2 focus:ring-brand/10",
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
    <div className="flex min-h-screen">
      {/* Left brand panel — hidden on mobile/tablet */}
      <BrandPanel />

      {/* Right login area */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#f5f6f8] p-6">
        {/* Mobile-only brand header */}
        <div className="mb-6 flex flex-col items-center lg:hidden">
          <span
            className="text-2xl font-bold tracking-[0.22em] text-brand"
            style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}
          >
            TSTECK
          </span>
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Engenharia Operacional
          </span>
        </div>

        {/* Login card */}
        <div
          className="w-full max-w-[420px]"
          style={{ animation: "fadeScaleIn 280ms ease-out both" }}
        >
          <div className="rounded-2xl bg-white px-8 py-7 shadow-[0_4px_32px_-8px_rgba(0,0,0,0.12),0_1px_4px_rgba(0,0,0,0.04)]">
            {/* Card header */}
            <div className="mb-7">
              <span
                className="hidden text-[1.1rem] font-bold tracking-[0.22em] text-brand lg:block"
                style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}
              >
                TSTECK
              </span>
              <h1 className="mt-1.5 text-[1.2rem] font-semibold tracking-tight text-zinc-900">
                Acessar sistema
              </h1>
              <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">
                Entre com suas credenciais para acessar o Pipeline de Projetos.
              </p>
            </div>

            {/* Global error alert */}
            {globalError && (
              <div
                className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] text-red-600"
                role="alert"
                style={{ animation: "fadeScaleIn 180ms ease-out both" }}
              >
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                {globalError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-4">
                {/* Email / username */}
                <InputField
                  id="login-email"
                  label="Usuário ou e-mail"
                  value={email}
                  onChange={(v) => {
                    setEmail(v);
                    clearFieldError("email");
                  }}
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
                      className="text-[13px] font-medium text-zinc-700"
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
                    onChange={(v) => {
                      setPassword(v);
                      clearFieldError("password");
                    }}
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
              <label className="mt-4 flex cursor-pointer select-none items-center gap-2 text-[13px] text-zinc-500">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-[15px] w-[15px] rounded border-zinc-300 accent-brand"
                  disabled={loading}
                />
                Manter conectado
              </label>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white transition-all duration-150",
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
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeOpacity="0.3"
                      />
                      <path
                        d="M12 3a9 9 0 0 1 9 9"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
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

            {/* Card footer */}
            <p className="mt-6 text-center text-[11px] leading-relaxed text-zinc-400">
              Acesso restrito aos usuários autorizados.
              <br />
              Ambiente interno TSTECK. O acesso é monitorado.
            </p>
          </div>

          {/* Version tag */}
          <p className="mt-4 text-center text-[11px] text-zinc-400/50">
            v1.0.0 — Pipeline de Projetos
          </p>
        </div>
      </div>
    </div>
  );
}
