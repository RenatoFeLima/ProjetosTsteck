"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Engenheiro } from "@/features/master-data/domain/master-data-types";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  item?: Engenheiro;
  onClose: () => void;
  onSave: (data: Partial<Engenheiro>) => void;
};

const inputCls = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
      {children}
    </div>
  );
}

export function EngenheiroFormDialog({ open, mode, item, onClose, onSave }: Props) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (open) {
      setName(item?.name ?? "");
      setEmail(item?.email ?? "");
      setPhone(item?.phone ?? "");
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open, item]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), email: email.trim(), phone: phone.trim() });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-base font-bold text-zinc-900">{mode === "create" ? "Novo Engenheiro" : "Editar Engenheiro"}</h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <Field label="Nome *">
            <input ref={nameRef} required value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Eng. João Silva" className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="E-mail">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Telefone">
              <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 9xxxx-xxxx" className={inputCls} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-300">Cancelar</button>
            <button type="submit" disabled={!name.trim()} className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand disabled:opacity-40">Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
