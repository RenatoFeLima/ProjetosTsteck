"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, EyeOff, KeyRound, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/hooks/use-auth";

export function ChangePasswordPage() {
  const { session, isLoading, changePassword } = useAuth();
  const router = useRouter();

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!session) { router.replace("/login"); return; }
    if (!session.user.mustChangePassword) { router.replace("/"); }
  }, [isLoading, session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!newPassword || newPassword.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    const result = await changePassword(newPassword);
    if (result.ok) {
      router.replace("/");
    } else {
      setError(result.error ?? "Erro ao alterar senha.");
      setSubmitting(false);
    }
  }

  if (isLoading || !session) return null;

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/Login.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full select-none pointer-events-none object-cover object-[35%_center]"
      />
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute inset-y-0 right-0 hidden w-[58%] bg-gradient-to-l from-black/55 via-black/25 to-transparent lg:block" />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-6 lg:justify-end lg:pr-[9vw] xl:pr-[11vw]">
        <div className="w-full max-w-[440px]" style={{ animation: "fadeScaleIn 340ms cubic-bezier(0.22,1,0.36,1) both" }}>
          <div
            className="rounded-3xl border px-8 py-8 shadow-[0_32px_80px_rgba(0,0,0,0.45),0_4px_20px_rgba(0,0,0,0.28)]"
            style={{
              background: "var(--glass-bg)",
              borderColor: "var(--glass-border)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <div className="mb-7">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
                  <KeyRound size={18} className="text-brand" />
                </div>
              </div>
              <div className="mb-4 h-[2px] w-10 rounded-full bg-brand" />
              <h1 className="text-[1.2rem] font-semibold tracking-tight text-zinc-900 dark:text-foreground">
                Trocar senha
              </h1>
              <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400 dark:text-zinc-500">
                Olá, <strong className="text-zinc-700 dark:text-zinc-300">{session.user.name}</strong>. Você precisa definir uma nova senha antes de continuar.
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-100 dark:border-red-700/40 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-[13px] text-red-600 dark:text-red-300" role="alert">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-4">
                {/* Nova senha */}
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                    Nova senha
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                      <Lock size={15} />
                    </span>
                    <input
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
                      placeholder="••••••••"
                      disabled={submitting}
                      autoComplete="new-password"
                      className="h-[52px] w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-panel-soft pl-10 pr-10 text-[14px] text-zinc-900 dark:text-foreground outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/10 placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((s) => !s)}
                      tabIndex={-1}
                      aria-label={showNew ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-600"
                    >
                      {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Confirmar */}
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                    Confirmar nova senha
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                      <Lock size={15} />
                    </span>
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => { setConfirm(e.target.value); setError(null); }}
                      placeholder="••••••••"
                      disabled={submitting}
                      autoComplete="new-password"
                      className={cn(
                        "h-[52px] w-full rounded-xl border bg-white dark:bg-panel-soft pl-10 pr-10 text-[14px] text-zinc-900 dark:text-foreground outline-none transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-600",
                        confirm && confirm !== newPassword
                          ? "border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                          : "border-zinc-200 dark:border-white/10 focus:border-brand focus:ring-2 focus:ring-brand/10",
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((s) => !s)}
                      tabIndex={-1}
                      aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-600"
                    >
                      {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  "mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white transition-all",
                  submitting ? "cursor-not-allowed bg-brand/75" : "bg-brand hover:bg-brand-dark active:scale-[0.99]",
                )}
              >
                {submitting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                      <path d="M12 3a9 9 0 0 1 9 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    Salvando...
                  </>
                ) : (
                  "Definir nova senha"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
