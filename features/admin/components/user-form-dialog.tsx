"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Eye, EyeOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDefaultPermissions, ROLE_LABELS } from "@/features/auth/lib/permissions";
import * as usersApi from "@/features/admin/lib/users-api";
import { PermissionsEditor } from "./permissions-editor";
import type { User, UserPermissions, UserRole } from "@/features/auth/lib/auth-types";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Mode = "create" | "edit";

type UserFormDialogProps = {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  /** Usuário existente (obrigatório para mode=edit) */
  user?: User | null;
  /** Chamado após criar/editar com sucesso (para recarregar a lista). */
  onSaved?: () => void | Promise<void>;
};

const ROLES: UserRole[] = ["ADMIN", "MANAGER", "PROJECTS", "COMMERCIAL", "VIEWER", "CUSTOM"];

// ─── Componente ───────────────────────────────────────────────────────────────

export function UserFormDialog({ open, onClose, mode, user, onSaved }: UserFormDialogProps) {

  // Form fields
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("VIEWER");
  const [active, setActive] = useState(true);
  const [mustChange, setMustChange] = useState(true);
  const [permissions, setPermissions] = useState<UserPermissions>(getDefaultPermissions("VIEWER"));
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);

  // Reset form when dialog opens/changes
  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && user) {
      setName(user.name);
      setUsername(user.username);
      setEmail(user.email ?? "");
      setRole(user.role);
      setActive(user.active);
      setMustChange(user.mustChangePassword);
      setPermissions(user.permissions);
    } else {
      setName("");
      setUsername("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setRole("VIEWER");
      setActive(true);
      setMustChange(true);
      setPermissions(getDefaultPermissions("VIEWER"));
    }
    setError(null);
    setSubmitting(false);
    setTimeout(() => nameRef.current?.focus(), 50);
  }, [open, mode, user]);

  // Reset permissions when role changes (except CUSTOM where user may customize)
  function handleRoleChange(r: UserRole) {
    setRole(r);
    if (r !== "CUSTOM") {
      setPermissions(getDefaultPermissions(r));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !username.trim()) {
      setError("Nome e usuário são obrigatórios.");
      return;
    }

    if (mode === "create") {
      if (!password) { setError("A senha é obrigatória."); return; }
      if (password.length < 6) { setError("A senha deve ter pelo menos 6 caracteres."); return; }
      if (password !== confirmPassword) { setError("As senhas não coincidem."); return; }
    }

    setSubmitting(true);
    try {
      if (mode === "create") {
        await usersApi.createUser({
          username: username.trim(),
          name: name.trim(),
          email: email.trim() || undefined,
          password,
          role,
          active,
          mustChangePassword: mustChange,
          permissions,
        });
      } else if (user) {
        await usersApi.updateUser(user.id, {
          name: name.trim(),
          email: email.trim() || null,
          role,
          active,
          mustChangePassword: mustChange,
          permissions,
        });
      }
      await onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const title = mode === "create" ? "Novo usuário" : "Editar usuário";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="user-form-title">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-white/8 px-6 py-4">
          <h2 id="user-form-title" className="text-[15px] font-semibold text-zinc-900 dark:text-foreground">
            {title}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/5 hover:text-zinc-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="space-y-5 px-6 py-6">
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-100 dark:border-red-700/40 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-[13px] text-red-600 dark:text-red-300" role="alert">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Nome e Usuário */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                  Nome completo <span className="text-red-500">*</span>
                </label>
                <input
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  className={inputCls}
                  placeholder="Ex.: João da Silva"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                  Usuário <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                  disabled={mode === "edit" || submitting}
                  className={cn(inputCls, mode === "edit" && "opacity-60 cursor-not-allowed")}
                  placeholder="Ex.: JoaoSilva"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* E-mail */}
            <div>
              <label className="mb-1.5 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className={inputCls}
                placeholder="opcional"
                autoComplete="off"
              />
            </div>

            {/* Senha (somente criação) */}
            {mode === "create" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                    Senha inicial <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={submitting}
                      className={cn(inputCls, "pr-9")}
                      placeholder="Mín. 6 caracteres"
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPassword((s) => !s)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                    Confirmar senha <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={submitting}
                      className={cn(inputCls, "pr-9", confirmPassword && confirmPassword !== password && "border-red-300 focus:border-red-400")}
                      placeholder="Repita a senha"
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowConfirm((s) => !s)} tabIndex={-1} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                      {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Perfil + Status */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[13px] font-medium text-zinc-700 dark:text-zinc-300">
                  Perfil
                </label>
                <select
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                  disabled={submitting}
                  className={cn(inputCls, "cursor-pointer")}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-6">
                <ToggleField
                  id="active-toggle"
                  label="Usuário ativo"
                  checked={active}
                  onChange={setActive}
                  disabled={submitting}
                />
                <ToggleField
                  id="mustchange-toggle"
                  label="Trocar senha no login"
                  checked={mustChange}
                  onChange={setMustChange}
                  disabled={submitting}
                />
              </div>
            </div>

            {/* Permissões personalizadas */}
            {role === "CUSTOM" && (
              <PermissionsEditor
                permissions={permissions}
                onChange={setPermissions}
                disabled={submitting}
              />
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-zinc-100 dark:border-white/8 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-zinc-200 dark:border-white/10 px-5 py-2.5 text-[13px] font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-brand px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-brand/90 active:scale-[0.99] transition-all disabled:opacity-60"
            >
              {submitting ? "Salvando…" : mode === "create" ? "Criar usuário" : "Salvar alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

const inputCls = cn(
  "h-[42px] w-full rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-panel-soft px-3.5 text-[13px]",
  "text-zinc-900 dark:text-foreground outline-none transition-all",
  "focus:border-brand focus:ring-2 focus:ring-brand/10",
  "placeholder:text-zinc-400 dark:placeholder:text-zinc-600",
  "disabled:opacity-60 disabled:cursor-not-allowed",
);

function ToggleField({
  id, label, checked, onChange, disabled,
}: {
  id: string; label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer select-none flex-col gap-1.5">
      <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 rounded-full border-2 transition-all focus:outline-none focus:ring-2 focus:ring-brand/25",
          checked ? "border-brand bg-brand" : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-panel",
          disabled && "opacity-60 cursor-not-allowed",
        )}
      >
        <span className={cn(
          "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-3.5" : "translate-x-0.5",
        )} />
      </button>
    </label>
  );
}
