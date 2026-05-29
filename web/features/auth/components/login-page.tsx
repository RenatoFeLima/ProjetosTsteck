"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, Lock, LogIn, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/features/user/hooks/use-current-user";
import { MOCK_USER, validateCredentials } from "@/features/auth/lib/mock-auth";

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
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/TelaLogin.png')" }}
      />

      {/* Subtle dark overlay at the bottom for footer legibility */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/20 to-transparent" />

      {/* Footer */}
      <div className="relative z-10 flex h-full flex-col justify-end p-10 xl:p-12">
        <div className="flex items-center gap-3 text-[11px] text-white/60">
          <span>Pipeline de Projetos</span>
          <span className="h-px w-5 bg-white/30" />
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
            "h-[52px] w-full rounded-xl border bg-white pl-10 text-[14px] text-zinc-900 outline-none transition-all duration-150 placeholder:text-zinc-300",
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
      // Simula latência de autenticação
      await new Promise((resolve) => setTimeout(resolve, 1200));

      if (!validateCredentials(email.trim(), password)) {
        setGlobalError("Usuário ou senha inválidos. Verifique os dados e tente novamente.");
        setLoading(false);
        return;
      }

      identify({ name: MOCK_USER.displayName, role: MOCK_USER.role });
      router.push("/");
    } catch {
      setGlobalError("Não foi possível conectar. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">

      {/* ── Layer 1: Background image ── */}
      <img
        src="/Login.png"
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-[30%_top]"
      />

      {/* ── Layer 2: Right-side strong gradient — apaga o painel Layers e cria zona limpa ── */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/45 to-white/85" />
      {/* Extra fade no canto inferior direito (painel Layers) */}
      <div className="pointer-events-none absolute bottom-0 right-0 h-[55%] w-[40%] bg-gradient-to-tl from-white/90 via-white/60 to-transparent" />

      {/* ── Layer 3: Positioning shell ── */}
      <div className="absolute inset-0 flex items-center justify-center lg:justify-end lg:pr-[8vw]">
        <div
          className="w-full max-w-[480px] px-4 lg:px-0"
          style={{ animation: "fadeScaleIn 280ms ease-out both", transform: "translateY(-20px)" }}
        >

          {/* ── Card ── */}
          <div className="min-h-0 rounded-[28px] border border-white/80 bg-white/[0.98] p-11 shadow-[0_20px_60px_rgba(0,0,0,0.13),0_2px_8px_rgba(0,0,0,0.06)] backdrop-blur-sm sm:min-h-[560px]">

            {/* Header */}
            <div className="mb-7">
              <span className="block text-[11px] font-bold uppercase tracking-[0.28em] text-[#9e0b0f]">
                TSTECK
              </span>
              <h1 className="mt-2 text-[1.75rem] font-bold leading-tight tracking-tight text-[#262626]">
                Acessar sistema
              </h1>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[#6b7280]">
                Entre com suas credenciais para acessar<br /> o Pipeline de Projetos.
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
                {/* Email */}
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
                    <label htmlFor="login-password" className="text-[13px] font-medium text-[#262626]">
                      Senha
                    </label>
                    <button type="button" className="text-[12px] text-[#9e0b0f] transition hover:underline">
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
              <label className="mt-4 flex cursor-pointer select-none items-center gap-2.5 text-[13px] text-[#6b7280]">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 accent-[#9e0b0f]"
                  disabled={loading}
                />
                Manter conectado
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white transition-all duration-150",
                  loading
                    ? "cursor-not-allowed bg-[#9e0b0f]/70"
                    : "bg-[#9e0b0f] hover:bg-[#7f090c] active:scale-[0.99]",
                )}
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                      <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Acessando...
                  </>
                ) : (
                  <>
                    <LogIn size={16} />
                    Entrar
                  </>
                )}
              </button>
            </form>

            {/* Card footer */}
            <p className="mt-7 text-center text-[12px] leading-relaxed text-[#6b7280]">
              Acesso restrito aos usuários autorizados.<br />
              Ambiente interno TSTECK. O acesso é monitorado.
            </p>
          </div>

          {/* Version */}
          <p className="mt-3.5 text-center text-[11px] text-zinc-500/60">
            v1.0.0 — Pipeline de Projetos
          </p>
        </div>
      </div>
    </div>
  );
}
