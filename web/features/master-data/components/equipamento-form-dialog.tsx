"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { Equipamento } from "@/features/master-data/domain/master-data-types";
import { useSavingSubmit } from "@/features/master-data/hooks/use-saving-submit";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  item?: Equipamento;
  onClose: () => void;
  onSave: (data: Partial<Equipamento>) => void | Promise<unknown>;
};

const inputCls = "w-full rounded-xl border border-line bg-white dark:bg-panel-soft px-3 py-2.5 text-sm text-zinc-900 dark:text-foreground dark:placeholder:text-zinc-600 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</span>
      {children}
    </div>
  );
}

export function EquipamentoFormDialog({ open, mode, item, onClose, onSave }: Props) {
  const codeRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [family, setFamily] = useState("");
  const [capacity, setCapacity] = useState("");
  const [dimension, setDimension] = useState("");
  const [notes, setNotes] = useState("");
  const { saving, saveError, reset, submit } = useSavingSubmit();

  useEffect(() => {
    if (open) {
      setCode(item?.code ?? "");
      setDescription(item?.description ?? "");
      setFamily(item?.family ?? "");
      setCapacity(item?.capacity ?? "");
      setDimension(item?.dimension ?? "");
      setNotes(item?.notes ?? "");
      reset();
      setTimeout(() => codeRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item]);

  function requestClose() {
    if (!saving) onClose();
  }

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, saving]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    void submit(() =>
      onSave({ code: code.trim().toUpperCase(), description: description.trim(), family: family.trim(), capacity: capacity.trim(), dimension: dimension.trim(), notes: notes.trim() }),
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-panel border border-line dark:border-white/8 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-base font-bold text-zinc-900 dark:text-foreground">{mode === "create" ? "Novo Equipamento" : "Editar Equipamento"}</h2>
          <button type="button" onClick={requestClose} disabled={saving} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/8 disabled:opacity-40"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <Field label="Código *">
            <input ref={codeRef} required value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Ex: EK-20/30" className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Família">
              <input value={family} onChange={e => setFamily(e.target.value)} placeholder="Ex: EK" className={inputCls} />
            </Field>
            <Field label="Capacidade">
              <input value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="Ex: 20 ton" className={inputCls} />
            </Field>
          </div>
          <Field label="Descrição">
            <input value={description} onChange={e => setDescription(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Dimensão">
            <input value={dimension} onChange={e => setDimension(e.target.value)} placeholder="Ex: 2000x3000mm" className={inputCls} />
          </Field>
          <Field label="Observações">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls + " resize-none"} />
          </Field>
          {saveError && (
            <p className="rounded-xl border border-red-100 dark:border-red-700/40 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-300" role="alert">
              {saveError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={requestClose} disabled={saving} className="rounded-xl border border-line dark:border-white/15 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:bg-white/8 disabled:opacity-40">Cancelar</button>
            <button type="submit" disabled={!code.trim() || saving} className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-brand disabled:opacity-40">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
