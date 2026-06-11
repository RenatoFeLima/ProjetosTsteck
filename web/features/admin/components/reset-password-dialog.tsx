"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Eye, EyeOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import * as usersApi from "@/features/admin/lib/users-api";
import type { User } from "@/features/auth/lib/auth-types";

type ResetPasswordDialogProps = {
  open: boolean;
  onClose: () => void;
  user: User | null;
  onSaved?: () => void | Promise<void>;
};

export function ResetPasswordDialog({ open, onClose, user, onSaved }: ResetPasswordDialogProps) {

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [mustChange, setMustChange] = useState(true);
  const [showPwd, setShowPwd] = useState(false);
  const [showCfm, setShowCfm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPassword("");
    setConfirm("");
    setMustChange(true);
    setError(null);
    setSubmitting(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!password) { setError("A nova senha é obrigatória."); return; }
    if (password.length < 6) { setError("A senha deve ter pelo menos 6 caracteres."); return; }
    if (password !== confirm) { setError("As senhas não coincidem."); return; }
    if (!user) return;

    setSubmitting(true);
    try {
      await usersApi.resetPassword(user.id, password);
      // A API força "trocar no próximo login" ao redefinir senha de terceiros.
      // Se o admin desmarcou essa exigência, ajustamos em seguida.
      if (!mustChange) await usersApi.updateUser(user.id, { mustChangePassword: false });
      await onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao redefinir senha.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="reset-pwd-title">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/8 px-6 py-4">
          <div>
            <h2 id="reset-pwd-title" className="text-[15px] font-semibold text-zinc-900 dark:text-foreground">
              Redefinir senha
            </h2>
            <p className="text-[12px] text-zinc-500">{user.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-4 px-6 py-5">
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-100 dark:border-red-700/40 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-[13px] text-red-600 dark:text-red-300" role="alert">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                Nova senha <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  disabled={submitting}
                  placeholder="Mín. 6 caracteres"
                  autoComplete="new-password"
                  className={cn(inputCls, "pr-9")}
                />
                <button type="button" onClick={() => setShowPwd((s) => !s)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                Confirmar nova senha <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showCfm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(null); }}
                  disabled={submitting}
                  placeholder="Repita a senha"
                  autoComplete="new-password"
                  className={cn(inputCls, "pr-9", confirm && confirm !== password && "border-red-300 focus:border-red-400")}
                />
                <button type="button" onClick={() => setShowCfm((s) => !s)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                  {showCfm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Exigir troca */}
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={mustChange}
                onChange={(e) => setMustChange(e.target.checked)}
                disabled={submitting}
                className="h-4 w-4 rounded border-zinc-300 accent-brand cursor-pointer"
              />
              <span className="text-[13px] text-zinc-700 dark:text-zinc-300">
                Exigir troca no próximo login
              </span>
            </label>
          </div>

          <div className="flex justify-end gap-3 border-t border-zinc-100 dark:border-white/8 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-zinc-200 dark:border-white/10 px-4 py-2.5 text-[13px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-brand/90 active:scale-[0.99] transition-all disabled:opacity-60"
            >
              {submitting ? "Salvando…" : "Redefinir senha"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls = cn(
  "h-[42px] w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-panel-soft px-3.5 text-[13px]",
  "text-zinc-900 dark:text-foreground outline-none transition-all",
  "focus:border-brand focus:ring-2 focus:ring-brand/10",
  "placeholder:text-zinc-400 dark:placeholder:text-zinc-600",
  "disabled:opacity-60 disabled:cursor-not-allowed",
);
