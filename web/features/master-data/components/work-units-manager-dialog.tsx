"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pencil, Plus, Power, X } from "lucide-react";
import type { UnidadeObra } from "@/features/master-data/domain/master-data-types";
import { useMasterDataEntity } from "@/features/master-data/hooks/use-master-data-entity";

type Props = {
  open: boolean;
  /** Obra (Work) cujas unidades serão gerenciadas. */
  workId: string;
  obraName: string;
  onClose: () => void;
};

const inputCls =
  "w-full rounded-xl border border-line bg-white dark:bg-panel-soft px-3 py-2.5 text-sm text-zinc-900 dark:text-foreground dark:placeholder:text-zinc-600 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15";

type UnitRow = UnidadeObra & { workId: string };

// Seção "Unidades da Obra" (Torre / Bloco / Elevador / Etapa) do cadastro de Obra.
// Permite criar, editar, inativar e reativar unidades da obra selecionada, e mostra
// a quantidade de projetos vinculados por unidade.
export function WorkUnitsManagerDialog({ open, workId, obraName, onClose }: Props) {
  const api = useMasterDataEntity<UnitRow>("unidadesObra", { includeInactive: true });
  const nameRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // Só as unidades da obra atual.
  const allUnits = useMemo(
    () => api.items.filter((u) => u.workId === workId),
    [api.items, workId],
  );

  const inactiveCount = useMemo(() => allUnits.filter((u) => !u.active).length, [allUnits]);

  // Por padrão mostra apenas ativas (mantém a interface limpa); o toggle revela
  // as inativas quando o usuário precisar reativá-las.
  const units = useMemo(
    () => (showInactive ? allUnits : allUnits.filter((u) => u.active)),
    [allUnits, showInactive],
  );

  useEffect(() => {
    if (open) {
      setName("");
      setEditingId(null);
      setError(null);
      setShowInactive(false);
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open, workId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, saving]);

  if (!open) return null;

  function startEdit(unit: UnitRow) {
    setEditingId(unit.id);
    setName(unit.name);
    setError(null);
    setTimeout(() => nameRef.current?.focus(), 50);
  }

  function cancelEdit() {
    setEditingId(null);
    setName("");
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await api.update(editingId, { name: trimmed });
      } else {
        await api.create({ workId, name: trimmed });
      }
      cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar unidade.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(unit: UnitRow) {
    try {
      await api.setActive(unit.id, !unit.active);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao alterar status da unidade.");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-900/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-line bg-white dark:border-white/8 dark:bg-panel shadow-2xl">
        <div className="flex items-start justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-foreground">Unidades da Obra</h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-muted">
              {obraName} · Torre / Bloco / Elevador / Etapa
            </p>
          </div>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            disabled={saving}
            title="Fechar"
            aria-label="Fechar gestor de unidades"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/8 disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        {/* Formulário de criação/edição */}
        <form onSubmit={handleSubmit} className="flex items-end gap-2 border-b border-line px-6 py-4">
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {editingId ? "Editar unidade" : "Nova unidade"}
            </span>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: T1 2°, ELEV 01, Bloco A"
              className={inputCls}
            />
          </div>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="rounded-xl border border-line px-3 py-2.5 text-sm font-medium text-zinc-700 hover:border-zinc-300 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/8 disabled:opacity-40"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand disabled:opacity-40"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {editingId ? "Salvar" : "Adicionar"}
          </button>
        </form>

        {error && (
          <p
            className="mx-6 mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Toggle de inativas — só aparece quando existem inativas (evita poluição) */}
        {inactiveCount > 0 && (
          <div className="flex items-center justify-end border-b border-line px-6 py-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-zinc-300 accent-brand"
              />
              Mostrar unidades inativas ({inactiveCount})
            </label>
          </div>
        )}

        {/* Lista de unidades */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {api.loading ? (
            <p className="py-6 text-center text-sm text-zinc-400">Carregando unidades...</p>
          ) : units.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-400">
              {allUnits.length === 0
                ? "Nenhuma unidade cadastrada para esta obra."
                : "Nenhuma unidade ativa. Marque “Mostrar unidades inativas” para vê-las."}
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {units.map((unit) => (
                <li
                  key={unit.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
                    unit.active
                      ? "border-line bg-white dark:border-white/8 dark:bg-panel-soft"
                      : "border-line bg-zinc-50/60 opacity-60 dark:bg-panel-soft/60"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-zinc-800 dark:text-foreground">
                        {unit.name}
                      </p>
                      <span
                        className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          unit.active ? "bg-ok/10 text-ok" : "bg-zinc-200 text-zinc-500 dark:bg-white/10 dark:text-zinc-400"
                        }`}
                      >
                        {unit.active ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-muted">
                      {unit.projectsCount ?? 0} projeto{(unit.projectsCount ?? 0) !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title={`Editar unidade "${unit.name}"`}
                      aria-label={`Editar unidade ${unit.name}`}
                      onClick={() => startEdit(unit)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/8 dark:hover:text-foreground"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      title={unit.active ? `Inativar unidade "${unit.name}"` : `Reativar unidade "${unit.name}"`}
                      aria-label={unit.active ? `Inativar unidade ${unit.name}` : `Reativar unidade ${unit.name}`}
                      onClick={() => toggle(unit)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                        unit.active
                          ? "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/8 dark:hover:text-foreground"
                          : "text-ok hover:bg-ok/10"
                      }`}
                    >
                      <Power size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end border-t border-line px-6 py-3">
          <button
            type="button"
            onClick={() => !saving && onClose()}
            disabled={saving}
            className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-300 dark:border-white/15 dark:text-zinc-300 dark:hover:bg-white/8 disabled:opacity-40"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
