"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Clock3, FileText, MessageSquare, PencilLine, X } from "lucide-react";
import {
  PRESET_CONSTRUTORAS,
  PRESET_EQUIPAMENTOS,
  PRESET_OBRAS,
  PRESET_OBRAS_BY_CONSTRUTORA,
  PRESET_VENDEDORES,
} from "@/features/projects/domain/project-directory";
import {
  computeNextAction,
  computeOperationalKpis,
  todayIsoDate,
  validateRequiredFields,
} from "@/features/projects/domain/project-rules";
import type { Project, ProjectObservation, StatusHistoryItem } from "@/features/projects/domain/project-types";
import { PrazoBadge, StatusBadge, UrgenteBadge } from "./pill-badges";
import { SearchableCombobox } from "./searchable-combobox";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";
import { formatPhone, formatProjectCode, normalizeEngineerName, stripPhone } from "./project-form-utils";

// ─── types ─────────────────────────────────────────────────────────────────

type ProjectDetailsDrawerProps = {
  open: boolean;
  project?: Project;
  initialMode?: DrawerMode;
  initialSection?: ViewSection;
  statusHistory: StatusHistoryItem[];
  observations: ProjectObservation[];
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Project>) => { ok: boolean; error?: string };
  onAddObservation: (projectId: string, text: string) => void;
  isCodigoDuplicado: (codigo: string, ignoreId?: string) => boolean;
  notify: (message: string) => void;
};

type DrawerMode = "view" | "edit";
type ViewSection = "overview" | "history";

type TimelineItem = {
  id: string;
  kind: "status" | "observation";
  when: string;
  title: string;
  description: string;
};

// ─── helpers ───────────────────────────────────────────────────────────────

function buildTimeline(
  statusHistory: StatusHistoryItem[],
  observations: ProjectObservation[],
): TimelineItem[] {
  const statusItems: TimelineItem[] = statusHistory.map((item) => ({
    id: `status-${item.id}`,
    kind: "status",
    when: item.alterado_em,
    title: "Mudança de status",
    description: `${item.status_de ?? "(inicio)"} -> ${item.status_para} (${item.origem})`,
  }));

  const observationItems: TimelineItem[] = observations.map((item) => ({
    id: `obs-${item.id}`,
    kind: "observation",
    when: item.criado_em,
    title: `Observação de ${item.usuario}`,
    description: item.texto,
  }));

  return [...statusItems, ...observationItems].sort((a, b) => (a.when < b.when ? 1 : -1));
}

const REQUIRED_FIELD_LABELS: Record<string, string> = {
  construtora: "Construtora",
  obra: "Obra",
  codigo_projeto: "Código do projeto",
  vendedor: "Vendedor",
  equipamento: "Equipamento",
  data_lancamento: "Data de lançamento",
};

// ─── small sub-components ──────────────────────────────────────────────────

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="block text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
        {required && <span className="ml-0.5 text-[#9e0b0f]">*</span>}
      </span>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs font-medium text-red-500">
          <AlertCircle size={11} />
          {error}
        </p>
      )}
    </div>
  );
}

function inputCls(hasError?: boolean) {
  return [
    "w-full rounded-xl border bg-white dark:bg-panel-soft px-3 py-2.5 text-sm text-zinc-900 dark:text-foreground",
    "placeholder-zinc-400 dark:placeholder:text-zinc-600 outline-none transition focus:ring-2",
    hasError
      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
      : "border-zinc-200 dark:border-white/8 focus:border-[#9e0b0f] focus:ring-[#9e0b0f]/10",
  ].join(" ");
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-zinc-100 dark:border-white/8 bg-zinc-50/60 dark:bg-panel-soft p-4">
      <div className="flex items-center gap-2">
        <div className="h-4 w-1 shrink-0 rounded-full bg-[#9e0b0f]" />
        <h3 className="text-sm font-bold text-zinc-900 dark:text-foreground">{title}</h3>
      </div>
      {children}
    </section>
  );
}

// ─── main component ─────────────────────────────────────────────────────────

export function ProjectDetailsDrawer({
  open,
  project,
  initialMode = "view",
  initialSection = "overview",
  statusHistory,
  observations,
  onClose,
  onUpdate,
  onAddObservation,
  isCodigoDuplicado,
  notify,
}: ProjectDetailsDrawerProps) {
  // view-mode state
  const [note, setNote] = useState("");

  // edit-mode state
  const [mode, setMode] = useState<DrawerMode>(initialMode);
  const [viewSection, setViewSection] = useState<ViewSection>(initialSection);
  const [editForm, setEditForm] = useState<Partial<Project>>(() => {
    if (!project || initialMode !== "edit") return {};
    return {
      ...project,
      codigo_projeto: formatProjectCode(project.codigo_projeto ?? ""),
      engenheiro_nome: normalizeEngineerName(project.engenheiro_nome ?? ""),
      engenheiro_celular: formatPhone(project.engenheiro_celular ?? ""),
    };
  });
  const [editDirty, setEditDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [confirmAlignOpen, setConfirmAlignOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // per-field validation errors
  const [construtoraError, setConstrutoraError] = useState("");
  const [obraError, setObraError] = useState("");
  const [codigoError, setCodigoError] = useState("");
  const [vendedorError, setVendedorError] = useState("");
  const [equipamentoError, setEquipamentoError] = useState("");
  const [dataLancamentoError, setDataLancamentoError] = useState("");

  // keyboard handler — depends on mode and editDirty to avoid stale closures
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      if (mode === "edit") {
        if (editDirty) {
          setDiscardOpen(true);
        } else {
          setMode("view");
        }
      } else {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose, mode, editDirty]);

  const timeline = useMemo(
    () => buildTimeline(statusHistory, observations),
    [statusHistory, observations],
  );

  const kpis = useMemo(
    () => (project ? computeOperationalKpis(project, statusHistory) : null),
    [project, statusHistory],
  );

  const construtoraOptions = useMemo(() => {
    const all = [...PRESET_CONSTRUTORAS];
    if (editForm.construtora && !all.includes(editForm.construtora)) all.unshift(editForm.construtora);
    return Array.from(new Set(all)).map((value) => ({ value }));
  }, [editForm.construtora]);

  const obraOptions = useMemo(() => {
    if (editForm.construtora && PRESET_OBRAS_BY_CONSTRUTORA[editForm.construtora]) {
      return PRESET_OBRAS_BY_CONSTRUTORA[editForm.construtora];
    }
    return PRESET_OBRAS;
  }, [editForm.construtora]);

  const obraComboboxOptions = useMemo(
    () => Array.from(new Set(obraOptions)).map((value) => ({ value })),
    [obraOptions],
  );

  const vendedorOptions = useMemo(() => {
    const list = [...PRESET_VENDEDORES];
    if (editForm.vendedor && !list.includes(editForm.vendedor)) list.unshift(editForm.vendedor);
    return Array.from(new Set(list)).map((value) => ({ value }));
  }, [editForm.vendedor]);

  const equipamentoOptions = useMemo(() => {
    const list = [...PRESET_EQUIPAMENTOS];
    if (editForm.equipamento && !list.includes(editForm.equipamento)) list.unshift(editForm.equipamento);
    return Array.from(new Set(list)).map((value) => ({ value }));
  }, [editForm.equipamento]);

  const duplicatedCode = useMemo(() => {
    const code = formatProjectCode(editForm.codigo_projeto ?? "");
    if (!code || !project) return false;
    return isCodigoDuplicado(code, project.id);
  }, [editForm.codigo_projeto, project, isCodigoDuplicado]);

  const prerequisitesReady = Boolean(editForm.proj_obra_recebido && editForm.local_cabine_definido);

  if (!open || !project) return null;

  const isEdit = mode === "edit";
  const isHistoryView = !isEdit && viewSection === "history";

  // ─── view handlers ─────────────────────────────────────────────────────

  const enterEditMode = () => {
    setEditForm({
      ...project,
      codigo_projeto: formatProjectCode(project.codigo_projeto ?? ""),
      engenheiro_nome: normalizeEngineerName(project.engenheiro_nome ?? ""),
      engenheiro_celular: formatPhone(project.engenheiro_celular ?? ""),
    });
    setEditDirty(false);
    setConstrutoraError("");
    setObraError("");
    setCodigoError("");
    setVendedorError("");
    setEquipamentoError("");
    setDataLancamentoError("");
    setMode("edit");
  };

  const saveObservation = () => {
    const message = note.trim();
    if (!message) {
      notify("Informe uma observação antes de salvar.");
      return;
    }
    onAddObservation(project.id, message);
    setNote("");
    notify("Observacao registrada no projeto.");
  };

  function handleClose() {
    if (isEdit && editDirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  }

  // ─── edit handlers ─────────────────────────────────────────────────────

  function patchEdit(next: Partial<Project>) {
    setEditForm((prev) => ({ ...prev, ...next }));
    setEditDirty(true);
    if (next.construtora !== undefined) setConstrutoraError("");
    if (next.obra !== undefined) setObraError("");
    if (next.codigo_projeto !== undefined) setCodigoError("");
    if (next.vendedor !== undefined) setVendedorError("");
    if (next.equipamento !== undefined) setEquipamentoError("");
    if (next.data_lancamento !== undefined) setDataLancamentoError("");
  }

  function handleCancelEdit() {
    if (editDirty) {
      setDiscardOpen(true);
    } else {
      setMode("view");
    }
  }

  function buildNormalizedPayload(): Partial<Project> {
    return {
      ...editForm,
      codigo_projeto: formatProjectCode(editForm.codigo_projeto ?? ""),
      engenheiro_nome: normalizeEngineerName(editForm.engenheiro_nome ?? ""),
      engenheiro_celular: stripPhone(editForm.engenheiro_celular ?? ""),
    };
  }

  function validateEdit(payload: Partial<Project>): boolean {
    setConstrutoraError("");
    setObraError("");
    setCodigoError("");
    setVendedorError("");
    setEquipamentoError("");
    setDataLancamentoError("");

    const missing = validateRequiredFields(payload as Project);
    let valid = true;

    if (missing.includes("construtora")) { setConstrutoraError("Selecione uma construtora."); valid = false; }
    if (missing.includes("obra")) { setObraError("Selecione uma obra."); valid = false; }
    if (missing.includes("codigo_projeto")) { setCodigoError("Informe o código do projeto."); valid = false; }
    if (missing.includes("vendedor")) { setVendedorError("Selecione um vendedor."); valid = false; }
    if (missing.includes("equipamento")) { setEquipamentoError("Selecione um equipamento."); valid = false; }
    if (missing.includes("data_lancamento")) { setDataLancamentoError("Informe uma data válida."); valid = false; }

    if (!valid) {
      notify(`Campos obrigatórios: ${missing.map((k) => REQUIRED_FIELD_LABELS[k] ?? k).join(", ")}`);
      return false;
    }

    if (duplicatedCode) {
      setCodigoError("Código de projeto já existe.");
      notify("Código de projeto duplicado.");
      return false;
    }

    return true;
  }

  function handleSubmitEdit() {
    const payload = buildNormalizedPayload();
    if (!validateEdit(payload)) return;
    setConfirmSaveOpen(true);
  }

  const confirmSave = () => {
    if (isSaving) return;
    const payload = buildNormalizedPayload();
    setIsSaving(true);
    const result = onUpdate(project.id, payload);
    setIsSaving(false);

    if (!result.ok) {
      notify(result.error ?? "Falha ao atualizar projeto.");
      setConfirmSaveOpen(false);
      return;
    }

    setConfirmSaveOpen(false);
    setEditDirty(false);
    setMode("view");
    notify("Projeto atualizado com sucesso.");
  }

  function confirmAlignment() {
    if (!prerequisitesReady) return;
    setConfirmAlignOpen(false);
    patchEdit({
      alinhamento: true,
      data_alinhamento: editForm.data_alinhamento || todayIsoDate(),
      status_atual: "ELABORAR ANTE-PROJETO",
    });
    notify("Alinhamento confirmado. Status atualizado para Elaborar Ante-Projeto.");
  }

  // ─── render ─────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[92] bg-black/45"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? `Editar projeto ${project.codigo_projeto}` : `Painel operacional ${project.codigo_projeto}`}
        className="ml-auto flex h-full w-full max-w-[700px] flex-col border-l border-zinc-200 dark:border-white/8 bg-white dark:bg-panel shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <header
          className={[
            "shrink-0 border-b px-5 py-4",
            isEdit ? "border-amber-200 dark:border-amber-700/40 bg-amber-50/50 dark:bg-amber-900/15" : "border-zinc-200 dark:border-white/8 bg-white dark:bg-panel",
          ].join(" ")}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {isEdit ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 dark:border-amber-700/40 bg-amber-100 dark:bg-amber-900/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    <PencilLine size={10} />
                    Modo edição
                  </span>
                  <h2 className="mt-1 font-display text-xl font-bold text-zinc-900 dark:text-foreground">Editar Projeto</h2>
                  <p className="truncate text-sm text-zinc-500 dark:text-muted">
                    {editForm.codigo_projeto || project.codigo_projeto} — {project.construtora} / {project.obra}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Painel Operacional</p>
                  <h2 className="font-display text-xl font-bold tracking-tight text-zinc-900 dark:text-foreground">{project.codigo_projeto}</h2>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{project.construtora} / {project.obra}</p>
                </>
              )}
            </div>
            <button
              type="button"
              aria-label="Fechar painel"
              onClick={handleClose}
              className="ml-1 shrink-0 rounded-lg border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel-soft p-2 text-zinc-500 dark:text-zinc-400 transition hover:border-zinc-300 dark:hover:border-white/15 hover:text-zinc-900 dark:hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e0b0f]/40"
            >
              <X size={16} />
            </button>
          </div>

          {!isEdit && (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={project.status_atual} />
                <UrgenteBadge urgente={project.urgente} />
                <PrazoBadge project={project} />
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={enterEditMode}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#9e0b0f] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#7f090c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e0b0f]/50"
                >
                  <PencilLine size={14} />
                  Editar projeto
                </button>
              </div>
              <div className="mt-3 inline-flex rounded-lg border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft p-1">
                <button
                  type="button"
                  onClick={() => setViewSection("overview")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    viewSection === "overview" ? "bg-white dark:bg-panel text-zinc-900 dark:text-foreground shadow-sm" : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  Resumo
                </button>
                <button
                  type="button"
                  onClick={() => setViewSection("history")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    viewSection === "history" ? "bg-white dark:bg-panel text-zinc-900 dark:text-foreground shadow-sm" : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  Historico
                </button>
              </div>
            </>
          )}

          {isEdit && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="rounded-lg border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel-soft px-3 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                Cancelar edição
              </button>
              <button
                type="button"
                onClick={handleSubmitEdit}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-[#9e0b0f] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#7f090c] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e0b0f]/50"
              >
                <Check size={14} />
                {isSaving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          )}
        </header>

        {/* ── SCROLLABLE CONTENT ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {isEdit ? (
            /* ─────────────── EDIT FORM ─────────────────────────────────── */
            <div className="space-y-4 p-5">
              <p className="rounded-xl border border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/15 px-3 py-2.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                Atualize as informações cadastrais e operacionais deste projeto. Campos marcados com{" "}
                <span className="font-bold text-[#9e0b0f]">*</span> são obrigatórios.
              </p>

              {/* Identificação */}
              <SectionCard title="Identificação do Projeto">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Construtora" required error={construtoraError}>
                    <SearchableCombobox
                      value={editForm.construtora ?? ""}
                      options={construtoraOptions}
                      onChange={(v) => patchEdit({ construtora: v, obra: "" })}
                      placeholder="Selecione a construtora"
                      searchPlaceholder="Buscar construtora..."
                      emptyMessage="Nenhuma construtora encontrada."
                      ariaLabel="Selecionar construtora"
                      error={construtoraError}
                    />
                  </FormField>

                  <FormField label="Obra" required error={obraError}>
                    <SearchableCombobox
                      value={editForm.obra ?? ""}
                      options={obraComboboxOptions}
                      onChange={(v) => patchEdit({ obra: v })}
                      placeholder="Selecione a obra"
                      searchPlaceholder="Buscar obra..."
                      emptyMessage="Nenhuma obra encontrada."
                      ariaLabel="Selecionar obra"
                      error={obraError}
                    />
                  </FormField>

                  <FormField
                    label="Código do Projeto"
                    required
                    error={codigoError || (duplicatedCode ? "Código de projeto já existe." : "")}
                  >
                    <input
                      className={inputCls(Boolean(codigoError || duplicatedCode))}
                      placeholder="AAA-AAA-AAAA"
                      value={editForm.codigo_projeto ?? ""}
                      onChange={(e) => patchEdit({ codigo_projeto: formatProjectCode(e.target.value) })}
                    />
                  </FormField>

                  <FormField label="Vendedor" required error={vendedorError}>
                    <SearchableCombobox
                      value={editForm.vendedor ?? ""}
                      options={vendedorOptions}
                      onChange={(v) => patchEdit({ vendedor: v })}
                      placeholder="Selecione o vendedor"
                      searchPlaceholder="Buscar vendedor..."
                      emptyMessage="Nenhum vendedor encontrado."
                      ariaLabel="Selecionar vendedor"
                      error={vendedorError}
                    />
                  </FormField>

                  <FormField label="Equipamento" required error={equipamentoError}>
                    <SearchableCombobox
                      value={editForm.equipamento ?? ""}
                      options={equipamentoOptions}
                      onChange={(v) => patchEdit({ equipamento: v })}
                      placeholder="Selecione o equipamento"
                      searchPlaceholder="Buscar equipamento..."
                      emptyMessage="Nenhum equipamento encontrado."
                      ariaLabel="Selecionar equipamento"
                      error={equipamentoError}
                    />
                  </FormField>

                  <FormField label="Data de Lançamento" required error={dataLancamentoError}>
                    <input
                      type="date"
                      className={inputCls(Boolean(dataLancamentoError))}
                      value={editForm.data_lancamento ?? ""}
                      onChange={(e) => patchEdit({ data_lancamento: e.target.value })}
                    />
                  </FormField>
                </div>
              </SectionCard>

              {/* Contato Técnico */}
              <SectionCard title="Contato Técnico">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Engenheiro">
                    <input
                      className={inputCls()}
                      placeholder="Ex.: Luiz Freitas"
                      value={editForm.engenheiro_nome ?? ""}
                      onChange={(e) => patchEdit({ engenheiro_nome: e.target.value })}
                      onBlur={(e) => patchEdit({ engenheiro_nome: normalizeEngineerName(e.target.value) })}
                    />
                  </FormField>

                  <FormField label="Telefone do Engenheiro">
                    <input
                      className={inputCls()}
                      placeholder="(11) 99999-9999"
                      value={editForm.engenheiro_celular ?? ""}
                      onChange={(e) => patchEdit({ engenheiro_celular: formatPhone(e.target.value) })}
                    />
                  </FormField>

                  <FormField label="Tipo de Cabine">
                    <input
                      className={inputCls()}
                      placeholder="Ex.: Cabine Compacta"
                      value={editForm.tipo_cabine ?? ""}
                      onChange={(e) => patchEdit({ tipo_cabine: e.target.value })}
                    />
                  </FormField>
                </div>
              </SectionCard>

              {/* Alinhamento */}
              <SectionCard title="Alinhamento">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-3 transition hover:border-zinc-300 dark:hover:border-white/15">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded accent-[#9e0b0f]"
                      checked={Boolean(editForm.proj_obra_recebido)}
                      onChange={(e) => patchEdit({ proj_obra_recebido: e.target.checked })}
                    />
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Projeto de obra recebido</span>
                  </label>

                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-3 transition hover:border-zinc-300 dark:hover:border-white/15">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded accent-[#9e0b0f]"
                      checked={Boolean(editForm.local_cabine_definido)}
                      onChange={(e) => patchEdit({ local_cabine_definido: e.target.checked })}
                    />
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Local da cabine definido</span>
                  </label>

                  <div
                    className={[
                      "sm:col-span-2",
                      !prerequisitesReady && !editForm.alinhamento ? "opacity-60" : "",
                    ].join(" ")}
                  >
                    <label
                      className={[
                        "flex items-start gap-2.5 rounded-xl border p-3 transition",
                        prerequisitesReady
                          ? "cursor-pointer border-emerald-200 dark:border-emerald-700/40 bg-emerald-50/50 dark:bg-emerald-900/15 hover:border-emerald-300 dark:hover:border-emerald-700/60"
                          : "cursor-not-allowed border-zinc-200 dark:border-white/8 bg-white dark:bg-panel",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded accent-[#9e0b0f]"
                        checked={Boolean(editForm.alinhamento)}
                        disabled={!prerequisitesReady && !editForm.alinhamento}
                        onChange={(e) => {
                          if (e.target.checked) {
                            if (!prerequisitesReady) return;
                            setConfirmAlignOpen(true);
                            return;
                          }
                          if (editForm.status_atual !== "CADASTRO INICIAL") {
                            notify("Este projeto já foi liberado e não pode retornar ao estágio inicial.");
                            return;
                          }
                          patchEdit({ alinhamento: false, data_alinhamento: null });
                        }}
                      />
                      <div>
                        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Alinhamento concluído</span>
                        {editForm.alinhamento && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                            <Check size={11} /> Concluído
                          </span>
                        )}
                      </div>
                    </label>
                  </div>

                  {!prerequisitesReady && (
                    <p className="sm:col-span-2 rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft px-3 py-2 text-xs text-zinc-500 dark:text-muted">
                      Para concluir o alinhamento, confirme o recebimento do projeto e a definição do local da cabine.
                    </p>
                  )}

                  <FormField label="Data do Alinhamento">
                    <input
                      type="date"
                      className={inputCls()}
                      value={editForm.data_alinhamento ?? ""}
                      onChange={(e) => patchEdit({ data_alinhamento: e.target.value || null })}
                    />
                  </FormField>
                </div>
              </SectionCard>

              {/* Prioridade */}
              <SectionCard title="Prioridade">
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-3 transition hover:border-zinc-300 dark:hover:border-white/15">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded accent-[#9e0b0f]"
                    checked={Boolean(editForm.urgente)}
                    onChange={(e) => patchEdit({ urgente: e.target.checked })}
                  />
                  <div>
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Marcar como urgente</span>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-muted">Prioriza o projeto na fila de atendimento.</p>
                  </div>
                </label>
              </SectionCard>
            </div>
          ) : (
            /* ─────────────── VIEW MODE ──────────────────────────────────── */
            <div className="space-y-3 p-5">
              {isHistoryView ? (
                <section className="rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-3">
                  <h3 className="mb-2 text-sm font-bold text-zinc-900 dark:text-foreground">Timeline operacional completa</h3>
                  {timeline.length === 0 && (
                    <p className="rounded-xl border border-dashed border-zinc-300 dark:border-white/15 bg-zinc-50 dark:bg-panel-soft px-3 py-4 text-sm text-zinc-500 dark:text-muted">
                      Nenhum evento registrado ainda.
                    </p>
                  )}
                  <div className="space-y-2">
                    {timeline.map((item) => (
                      <article key={item.id} className="rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft p-3">
                        <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                          {item.kind === "status" ? <FileText size={12} /> : <MessageSquare size={12} />}
                          {item.title}
                        </p>
                        <p className="text-sm text-zinc-700 dark:text-zinc-300">{item.description}</p>
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-muted">
                          <Clock3 size={12} />
                          {new Date(item.when).toLocaleString()}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : (
                <>
              <section className="rounded-2xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft p-3">
                <h3 className="mb-2 text-sm font-bold text-zinc-900 dark:text-foreground">Próxima ação recomendada</h3>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{computeNextAction(project)}</p>
              </section>

              {kpis && (
                <section className="rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-3">
                  <h3 className="mb-2 text-sm font-bold text-zinc-900 dark:text-foreground">KPIs operacionais</h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <article className="rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-muted">Tempo no status atual</p>
                      <p className="mt-1 text-base font-bold text-zinc-900 dark:text-foreground">{kpis.diasNoStatusAtual} dias</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">Meta: {kpis.slaTargetDias} dias</p>
                    </article>
                    <article className="rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-muted">SLA status</p>
                      <p
                        className={[
                          "mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-bold",
                          kpis.slaState === "ok"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : kpis.slaState === "atencao"
                              ? "border-amber-200 dark:border-amber-700/40 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                              : "border-red-200 dark:border-red-700/50 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300",
                        ].join(" ")}
                      >
                        {kpis.slaState === "ok" ? "Dentro do SLA" : kpis.slaState === "atencao" ? "SLA em atenção" : "SLA estourado"}
                      </p>
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                        {kpis.slaRestanteDias >= 0
                          ? `${kpis.slaRestanteDias} dias restantes`
                          : `${Math.abs(kpis.slaRestanteDias)} dias de estouro`}
                      </p>
                    </article>
                    <article className="rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-muted">Dias desde cadastro</p>
                      <p className="mt-1 text-base font-bold text-zinc-900 dark:text-foreground">{kpis.diasDesdeCadastro} dias</p>
                    </article>
                    <article className="rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-muted">Dias sem atualização</p>
                      <p className="mt-1 text-base font-bold text-zinc-900 dark:text-foreground">{kpis.diasSemAtualizacao} dias</p>
                    </article>
                  </div>
                </section>
              )}

              <section className="grid gap-2 rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-3 text-sm dark:text-zinc-300 md:grid-cols-2">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-foreground md:col-span-2">Resumo rápido</h3>
                <p><span className="font-semibold">Vendedor:</span> {project.vendedor}</p>
                <p><span className="font-semibold">Equipamento:</span> {project.equipamento}</p>
                <p><span className="font-semibold">Engenheiro:</span> {project.engenheiro_nome || "Não informado"}</p>
                <p><span className="font-semibold">Lançamento:</span> {new Date(project.data_lancamento).toLocaleDateString()}</p>
              </section>

              <section className="rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-3">
                <h3 className="mb-2 text-sm font-bold text-zinc-900 dark:text-foreground">Adicionar observação rápida</h3>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Registrar contexto, bloqueios ou próxima tratativa..."
                  className="min-h-24 w-full rounded-xl border border-zinc-300 dark:border-white/8 bg-white dark:bg-panel-soft dark:text-foreground dark:placeholder:text-zinc-600 p-3 text-sm outline-none transition focus:border-[#9e0b0f]"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={saveObservation}
                    className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
                  >
                    <MessageSquare size={14} />
                    Salvar observacao
                  </button>
                </div>
              </section>

              <section className="rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-3">
                <h3 className="mb-2 text-sm font-bold text-zinc-900 dark:text-foreground">Timeline operacional</h3>
                {timeline.length === 0 && (
                  <p className="rounded-xl border border-dashed border-zinc-300 dark:border-white/15 bg-zinc-50 dark:bg-panel-soft px-3 py-4 text-sm text-zinc-500 dark:text-muted">
                    Nenhum evento registrado ainda.
                  </p>
                )}
                <div className="space-y-2">
                  {timeline.map((item) => (
                    <article key={item.id} className="rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft p-3">
                      <p className="mb-1 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                        {item.kind === "status" ? <FileText size={12} /> : <MessageSquare size={12} />}
                        {item.title}
                      </p>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">{item.description}</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-500 dark:text-muted">
                        <Clock3 size={12} />
                        {new Date(item.when).toLocaleString()}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
                </>
              )}
            </div>
          )}
        </div>
        {/* END SCROLLABLE CONTENT */}
      </aside>

      {/* ── DIALOGS ──────────────────────────────────────────────────────── */}

      <UnsavedChangesDialog
        open={discardOpen}
        onContinueEditing={() => setDiscardOpen(false)}
        onConfirmDiscard={() => {
          setDiscardOpen(false);
          setEditDirty(false);
          if (isEdit) {
            setMode("view");
          } else {
            onClose();
          }
        }}
      />

      {confirmAlignOpen && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4">
          <article
            role="dialog"
            aria-modal="true"
            aria-labelledby="align-confirm-title"
            className="w-full max-w-lg animate-[fadeScaleIn_150ms_ease-out] rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-6 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h3 id="align-confirm-title" className="text-lg font-bold text-zinc-900 dark:text-foreground">
              Confirmar alinhamento concluído?
            </h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Ao confirmar, este projeto será liberado para a equipe de projetos e o status será alterado automaticamente para{" "}
              <strong>ELABORAR ANTE-PROJETO</strong>. Essa ação indica que a documentação e a localização da cabine foram validadas.
            </p>
            <footer className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAlignOpen(false)}
                className="rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel-soft px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-white/8"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmAlignment}
                className="rounded-xl bg-[#9e0b0f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7f090c]"
              >
                Confirmar e liberar projeto
              </button>
            </footer>
          </article>
        </div>
      )}

      {confirmSaveOpen && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4">
          <article
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-edit-title"
            aria-describedby="confirm-edit-description"
            className="w-full max-w-lg animate-[fadeScaleIn_150ms_ease-out] rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-6 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="mb-4 flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#9e0b0f]/10 text-[#9e0b0f]">
                <Check size={18} />
              </span>
              <div>
                <h3 id="confirm-edit-title" className="text-lg font-bold text-zinc-900 dark:text-foreground">
                  Confirmar alterações?
                </h3>
                <p id="confirm-edit-description" className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Revise os dados antes de atualizar este projeto.
                </p>
              </div>
            </header>

            <div className="space-y-1.5 rounded-xl border border-zinc-100 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft p-3 text-sm">
              {[
                ["Construtora", editForm.construtora],
                ["Obra", editForm.obra],
                ["Código", editForm.codigo_projeto],
                ["Vendedor", editForm.vendedor],
                ["Equipamento", editForm.equipamento],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-zinc-500 dark:text-muted">{label}</span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">{value || "—"}</span>
                </div>
              ))}
            </div>

            <footer className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmSaveOpen(false)}
                className="rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel-soft px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-white/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                Continuar editando
              </button>
              <button
                type="button"
                onClick={confirmSave}
                disabled={isSaving}
                className="rounded-xl bg-[#9e0b0f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7f090c] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e0b0f]/50"
              >
                {isSaving ? "Salvando..." : "Salvar alterações"}
              </button>
            </footer>
          </article>
        </div>
      )}
    </div>
  );
}
