"use client";

// Modal "Criar lembrete para esta obra" — também usado para EDITAR um lembrete
// existente (mesmos campos/validações). Validação compartilhada com o backend
// via validateReminderInput (domínio puro).

import { useEffect, useState } from "react";
import { AlertCircle, BellPlus, Loader2 } from "lucide-react";
import {
  validateReminderInput,
  REMINDER_DESCRIPTION_MAX,
  type ProjectReminder,
  type ReminderPriority,
} from "@/features/projects/domain/project-reminders";
import { todayIsoDate, toDateInputValue } from "@/features/projects/domain/project-rules";
import type { Project } from "@/features/projects/domain/project-types";

export type ReminderFormValue = {
  descricao: string;
  prioridade: ReminderPriority;
  data_inicial: string;
  recorrencia_dias: number;
};

type ReminderFormDialogProps = {
  open: boolean;
  project?: Project;
  /** Quando presente, o modal edita este lembrete em vez de criar um novo. */
  reminder?: ProjectReminder | null;
  onCancel: () => void;
  onSave: (value: ReminderFormValue) => Promise<{ ok: boolean; error?: string }>;
};

const FIELD_IDS = {
  descricao: "reminder-descricao",
  prioridade: "reminder-prioridade",
  data: "reminder-data",
  recorrencia: "reminder-recorrencia",
};

export function ReminderFormDialog({ open, project, reminder, onCancel, onSave }: ReminderFormDialogProps) {
  // Fechado → desmontado. Ao abrir, o body monta do zero (key por lembrete),
  // inicializando os campos via useState — sem setState síncrono em effect.
  if (!open) return null;
  return (
    <ReminderFormDialogBody
      key={reminder?.id ?? "create"}
      project={project}
      reminder={reminder}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
}

function ReminderFormDialogBody({ project, reminder, onCancel, onSave }: Omit<ReminderFormDialogProps, "open">) {
  const isEdit = Boolean(reminder);
  const [descricao, setDescricao] = useState(reminder?.descricao ?? "");
  const [prioridade, setPrioridade] = useState<ReminderPriority>(reminder?.prioridade ?? "NORMAL");
  const [data, setData] = useState(() => toDateInputValue(reminder?.proxima_data ?? todayIsoDate()));
  const [recorrencia, setRecorrencia] = useState(String(reminder?.recorrencia_dias ?? 7));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (!saving) onCancel();
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onCancel, saving]);

  async function handleSave() {
    const validation = validateReminderInput({
      descricao,
      prioridade,
      data_inicial: data,
      recorrencia_dias: recorrencia,
    });
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    setServerError("");
    setSaving(true);
    const result = await onSave(validation.value);
    setSaving(false);
    if (!result.ok) {
      setServerError(result.error ?? "Não foi possível salvar o lembrete.");
    }
  }

  const inputCls = (hasError: boolean) =>
    [
      "w-full rounded-xl border bg-white dark:bg-panel-soft px-3 py-2 text-sm text-zinc-900 dark:text-foreground",
      "placeholder-zinc-400 dark:placeholder:text-zinc-600 outline-none transition focus:ring-2",
      hasError
        ? "border-red-300 focus:border-red-400 focus:ring-red-100"
        : "border-zinc-200 dark:border-white/8 focus:border-[#9e0b0f] focus:ring-[#9e0b0f]/10",
    ].join(" ");

  const fieldError = (key: string) =>
    errors[key] ? (
      <p className="flex items-center gap-1 text-xs font-medium text-red-500">
        <AlertCircle size={11} />
        {errors[key]}
      </p>
    ) : null;

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/50 p-4">
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-form-title"
        className="w-full max-w-[520px] animate-[fadeScaleIn_150ms_ease-out] rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-6 shadow-[0_32px_64px_-20px_rgba(0,0,0,0.35)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="mb-4 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-300">
            <BellPlus size={18} />
          </span>
          <div className="min-w-0">
            <h2 id="reminder-form-title" className="text-lg font-bold text-zinc-900 dark:text-foreground">
              {isEdit ? "Editar lembrete" : "Criar lembrete para esta obra"}
            </h2>
            {project && (
              <p
                className="mt-0.5 truncate text-sm text-zinc-600 dark:text-zinc-400"
                title={`${project.codigo_projeto} · ${project.construtora} — ${project.obra}`}
              >
                {project.codigo_projeto} · {project.construtora} — {project.obra}
              </p>
            )}
          </div>
        </header>

        <div className="grid gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={FIELD_IDS.descricao} className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Descrição do lembrete <span className="text-[#9e0b0f]">*</span>
            </label>
            <textarea
              autoFocus
              id={FIELD_IDS.descricao}
              rows={3}
              value={descricao}
              maxLength={REMINDER_DESCRIPTION_MAX}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: validar com o vendedor a quantidade de itens locados nessa obra."
              className={inputCls(Boolean(errors.descricao)) + " resize-none"}
            />
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">{fieldError("descricao")}</div>
              <span className="shrink-0 text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                {descricao.length}/{REMINDER_DESCRIPTION_MAX}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={FIELD_IDS.prioridade} className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Prioridade <span className="text-[#9e0b0f]">*</span>
              </label>
              <select
                id={FIELD_IDS.prioridade}
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value as ReminderPriority)}
                className={inputCls(Boolean(errors.prioridade))}
              >
                <option value="NORMAL">Normal</option>
                <option value="ALTA">Alta</option>
              </select>
              {fieldError("prioridade")}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={FIELD_IDS.data} className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {isEdit ? "Próxima data" : "Primeiro alerta"} <span className="text-[#9e0b0f]">*</span>
              </label>
              <input
                id={FIELD_IDS.data}
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className={inputCls(Boolean(errors.data_inicial))}
              />
              {fieldError("data_inicial")}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={FIELD_IDS.recorrencia} className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Repetir a cada X dias <span className="text-[#9e0b0f]">*</span>
              </label>
              <input
                id={FIELD_IDS.recorrencia}
                type="number"
                min={1}
                step={1}
                value={recorrencia}
                onChange={(e) => setRecorrencia(e.target.value)}
                className={inputCls(Boolean(errors.recorrencia_dias))}
              />
              {fieldError("recorrencia_dias")}
            </div>
          </div>

          <p className="text-xs text-zinc-500 dark:text-muted">
            A equipe de Projetos será alertada no primeiro alerta e novamente a cada X dias, até que o lembrete
            seja resolvido.
          </p>

          {serverError && (
            <p className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:border-red-700/50 dark:bg-red-900/20 dark:text-red-300">
              <AlertCircle size={12} />
              {serverError}
            </p>
          )}
        </div>

        <footer className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel-soft px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#9e0b0f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#870a0d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e0b0f]/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <BellPlus size={14} />}
            {saving ? "Salvando..." : "Salvar lembrete"}
          </button>
        </footer>
      </article>
    </div>
  );
}
