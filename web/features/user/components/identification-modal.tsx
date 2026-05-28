"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { CurrentUser, UserRole } from "@/features/user/hooks/use-current-user";

const ROLES: UserRole[] = ["Vendedor", "Engenheiro", "Gerente", "Admin"];

type Props = {
  open: boolean;
  onClose: () => void;
  onSave: (user: CurrentUser) => void;
  current?: CurrentUser | null;
};

export function IdentificationModal({ open, onClose, onSave, current }: Props) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("Vendedor");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(current?.name ?? "");
      setRole(current?.role ?? "Vendedor");
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open, current]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({ name: trimmed, role });
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-900/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-lg font-bold text-zinc-900">Identificação</h2>
          {current && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
              aria-label="Fechar"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-4 flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500" htmlFor="ident-name">
              Seu nome <span className="text-brand">*</span>
            </label>
            <input
              id="ident-name"
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Silva"
              required
              className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-zinc-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </div>

          <div className="mb-6 flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Perfil de acesso
            </span>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={[
                    "rounded-xl border px-4 py-2.5 text-sm font-medium transition",
                    role === r
                      ? "border-brand bg-brand/5 text-brand"
                      : "border-line bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900",
                  ].join(" ")}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white transition hover:bg-brand disabled:opacity-40"
          >
            Confirmar
          </button>
        </form>
      </div>
    </div>
  );
}
