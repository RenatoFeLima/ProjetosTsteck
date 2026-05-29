"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { useMasterDataStore } from "@/features/master-data/state/master-data-store";
import { todayIsoDate, validateRequiredFields } from "@/features/projects/domain/project-rules";
import type { Project, ProjectStatus, StatusHistoryItem } from "@/features/projects/domain/project-types";
import { PrazoBadge, StatusBadge, UrgenteBadge } from "./pill-badges";
import { SearchableCombobox } from "./searchable-combobox";
import { ConfirmProjectCreateDialog } from "./confirm-project-create-dialog";
import { MissingRequiredFieldsDialog } from "./missing-required-fields-dialog";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";
import { formatPhone, formatProjectCode, normalizeEngineerName, stripPhone } from "./project-form-utils";

const STATUS_OPTIONS: ProjectStatus[] = [
  "CADASTRO INICIAL",
  "ELABORAR ANTE-PROJETO",
  "ANTE-PROJETO ENVIADO",
  "ANTE-PROJETO APROVADO",
  "PROJETO APROVADO",
  "PROJETO FINAL ENVIADO",
  "REVISAO DE ESTUDO",
];

const REQUIRED_FIELD_LABELS: Record<string, string> = {
  construtora: "Construtora",
  obra: "Obra",
  codigo_projeto: "Codigo do projeto",
  vendedor: "Vendedor",
  equipamento: "Equipamento",
  data_lancamento: "Data do cadastro",
};

type ProjectFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  quickMode?: boolean;
  project?: Project;
  statusHistory: StatusHistoryItem[];
  observations: Array<{ id: string; usuario: string; texto: string; criado_em: string }>;
  onClose: () => void;
  onCreate: (input: Partial<Project>) => { ok: boolean; error?: string; missing?: string[] };
  onUpdate: (id: string, patch: Partial<Project>) => { ok: boolean; error?: string };
  onDelete: (id: string) => void;
  onMoveStatus: (id: string, nextStatus: ProjectStatus) => { ok: boolean; error?: string };
  isCodigoDuplicado: (codigo: string, ignoreId?: string) => boolean;
  onAddObservation: (projectId: string, text: string) => void;
  notify: (message: string) => void;
};

function blankProject(): Partial<Project> {
  return {
    construtora: "",
    obra: "",
    engenheiro_nome: "",
    engenheiro_celular: "",
    equipamento: "",
    tipo_cabine: "",
    codigo_projeto: "",
    vendedor: "",
    proj_obra_recebido: false,
    local_cabine_definido: false,
    alinhamento: false,
    data_lancamento: todayIsoDate(),
    data_alinhamento: null,
    status_atual: "CADASTRO INICIAL",
    data_envio: null,
    data_aprovacao: null,
    urgente: false,
  };
}

// ─── form field helpers ──────────────────────────────────────────────────

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

function modalInputCls(hasError?: boolean) {
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

export function ProjectFormModal(props: ProjectFormModalProps) {
  const [form, setForm] = useState<Partial<Project>>(blankProject());
  const [dirty, setDirty] = useState(false);
  const [obsText, setObsText] = useState("");
  const [confirmAlignmentOpen, setConfirmAlignmentOpen] = useState(false);
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const [isSavingCreate, setIsSavingCreate] = useState(false);
  const [missingRequiredOpen, setMissingRequiredOpen] = useState(false);
  const [missingRequiredLabels, setMissingRequiredLabels] = useState<string[]>([]);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [construtoraError, setConstrutoraError] = useState("");
  const [obraError, setObraError] = useState("");

  useEffect(() => {
    if (!props.open) return;
    const source = props.mode === "edit" && props.project ? props.project : blankProject();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      ...source,
      codigo_projeto: formatProjectCode(source.codigo_projeto ?? ""),
      engenheiro_nome: normalizeEngineerName(source.engenheiro_nome ?? ""),
      engenheiro_celular: formatPhone(source.engenheiro_celular ?? ""),
    });
    setDirty(false);
    setObsText("");
    setConfirmAlignmentOpen(false);
    setConfirmCreateOpen(false);
    setIsSavingCreate(false);
    setMissingRequiredOpen(false);
    setMissingRequiredLabels([]);
    setDiscardDialogOpen(false);
    setConstrutoraError("");
    setObraError("");
  }, [props.open, props.mode, props.project]);

  const masterData = useMasterDataStore();

  const duplicated = useMemo(() => {
    const code = formatProjectCode(form.codigo_projeto ?? "");
    if (!code) return false;
    return props.isCodigoDuplicado(code, props.project?.id);
  }, [form.codigo_projeto, props]);

  const obraOptions = useMemo(() => {
    if (form.construtora) {
      const obrasByConstrutora = masterData.getActiveObraNames(form.construtora);
      if (obrasByConstrutora.length > 0) return obrasByConstrutora;
    }
    return masterData.getActiveObraNames();
  }, [masterData, form.construtora]);

  const construtoraOptions = useMemo(() => {
    const all = masterData.getActiveContrutoraNames();
    if (form.construtora && !all.includes(form.construtora)) {
      all.unshift(form.construtora);
    }
    return Array.from(new Set(all)).map((value) => ({ value }));
  }, [masterData, form.construtora]);

  const obraComboboxOptions = useMemo(
    () => Array.from(new Set(obraOptions)).map((value) => ({ value })),
    [obraOptions],
  );

  const vendedorComboboxOptions = useMemo(() => {
    const list = masterData.getActiveVendedorNames();
    if (form.vendedor && !list.includes(form.vendedor)) {
      list.unshift(form.vendedor);
    }
    return Array.from(new Set(list)).map((value) => ({ value }));
  }, [masterData, form.vendedor]);

  const equipamentoComboboxOptions = useMemo(() => {
    const list = masterData.getActiveEquipamentoCodes();
    if (form.equipamento && !list.includes(form.equipamento)) {
      list.unshift(form.equipamento);
    }
    return Array.from(new Set(list)).map((value) => ({ value }));
  }, [masterData, form.equipamento]);

  const tipoCabineComboboxOptions = useMemo(() => {
    const list = masterData.getActiveTipoCabineNames();
    if (form.tipo_cabine && !list.includes(form.tipo_cabine)) {
      list.unshift(form.tipo_cabine);
    }
    return Array.from(new Set(list)).map((value) => ({ value }));
  }, [masterData, form.tipo_cabine]);

  const statusComboboxOptions = useMemo(
    () => STATUS_OPTIONS.map((value) => ({ value, label: value.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()) })),
    [],
  );

  if (!props.open) return null;

  const prerequisitesReady = Boolean(form.proj_obra_recebido && form.local_cabine_definido);

  function patch(next: Partial<Project>) {
    const merged = { ...form, ...next };
    if (typeof next.construtora === "string" && next.construtora.trim()) {
      setConstrutoraError("");
    }
    if (typeof next.obra === "string" && next.obra.trim()) {
      setObraError("");
    }
    setForm(merged);
    setDirty(true);
  }

  function closeWithGuard() {
    if (dirty) {
      setDiscardDialogOpen(true);
      return;
    }
    props.onClose();
  }

  function buildNormalizedFormPayload(): Partial<Project> {
    const payload: Partial<Project> = {
      ...form,
      codigo_projeto: formatProjectCode(form.codigo_projeto ?? ""),
      engenheiro_nome: normalizeEngineerName(form.engenheiro_nome ?? ""),
      engenheiro_celular: stripPhone(form.engenheiro_celular ?? ""),
    };

    if (props.mode === "create") payload.status_atual = "CADASTRO INICIAL";
    return payload;
  }

  function validateBeforeSave(normalized: Partial<Project>): boolean {
    const missing = validateRequiredFields(normalized as Project);
    if (missing.length > 0) {
      const labels = missing.map((key) => REQUIRED_FIELD_LABELS[key] ?? key);
      setMissingRequiredLabels(labels);
      setMissingRequiredOpen(true);
      setConfirmCreateOpen(false);

      if (missing.includes("construtora")) {
        setConstrutoraError("Selecione uma construtora.");
      }
      if (missing.includes("obra")) {
        setObraError("Selecione uma obra.");
      }
      props.notify(`Campos obrigatorios: ${labels.join(", ")}`);
      return false;
    }

    if (duplicated) {
      props.notify("Codigo de projeto duplicado.");
      return false;
    }

    return true;
  }

  function confirmCreateSave() {
    if (isSavingCreate) return;

    const normalized = {
      ...buildNormalizedFormPayload(),
      status_atual: "CADASTRO INICIAL" as const,
    };

    if (!validateBeforeSave(normalized)) return;

    setIsSavingCreate(true);
    const result = props.onCreate(normalized);
    setIsSavingCreate(false);

    if (!result.ok) {
      props.notify(result.error ?? "Falha ao criar projeto");
      return;
    }

    setConfirmCreateOpen(false);
    props.notify("Projeto cadastrado com sucesso. O projeto foi criado como Cadastro Inicial e aguardara as proximas validacoes.");
    props.onClose();
  }

  function submit(event: FormEvent) {
    event.preventDefault();

    const normalized = buildNormalizedFormPayload();
    if (!validateBeforeSave(normalized)) return;

    if (props.mode === "create") {
      setConfirmCreateOpen(true);
      return;
    }

    if (!props.project) return;
    const result = props.onUpdate(props.project.id, normalized);
    if (!result.ok) {
      props.notify(result.error ?? "Falha ao atualizar projeto");
      return;
    }
    props.notify("Projeto atualizado com sucesso");
    props.onClose();
  }

  function requestDelete() {
    if (!props.project) return;
    if (!window.confirm("Deseja realmente excluir este projeto?")) return;
    props.onDelete(props.project.id);
    props.notify("Projeto excluido");
    props.onClose();
  }

  function confirmAlignment() {
    if (!prerequisitesReady) return;
    setConfirmAlignmentOpen(false);
    const nextPatch: Partial<Project> = {
      alinhamento: true,
      data_alinhamento: form.data_alinhamento || todayIsoDate(),
      status_atual: "ELABORAR ANTE-PROJETO",
    };

    if (props.mode === "edit" && props.project) {
      const result = props.onUpdate(props.project.id, {
        ...form,
        ...nextPatch,
        codigo_projeto: formatProjectCode(form.codigo_projeto ?? ""),
        engenheiro_nome: normalizeEngineerName(form.engenheiro_nome ?? ""),
        engenheiro_celular: stripPhone(form.engenheiro_celular ?? ""),
      });

      if (!result.ok) {
        props.notify(result.error ?? "Falha ao liberar projeto");
        return;
      }

      setForm((prev) => ({ ...prev, ...nextPatch }));
      setDirty(false);
      props.notify("Projeto liberado para elaboracao de ante-projeto.");
      return;
    }

    patch(nextPatch);
    props.notify("Projeto liberado para elaboracao de ante-projeto.");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-form-title"
        className="flex h-full w-full flex-col bg-white dark:bg-panel md:mx-auto md:my-8 md:h-[88vh] md:max-w-3xl md:rounded-2xl md:shadow-2xl"
      >
        {/* Fixed header */}
        <header className="shrink-0 border-b border-zinc-200 dark:border-white/8 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <span className="inline-flex rounded-full border border-[#9e0b0f]/20 bg-[#9e0b0f]/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#9e0b0f]">
                {props.mode === "create" ? (props.quickMode ? "Cadastro Rápido" : "Novo Projeto") : "Edição de Projeto"}
              </span>
              <h2 id="project-form-title" className="mt-1 font-display text-xl font-bold text-zinc-900 dark:text-foreground">
                {props.mode === "create" ? (props.quickMode ? "Criar Rápido" : "Novo Projeto") : "Editar Projeto"}
              </h2>
              <p className="text-sm text-zinc-500 dark:text-muted">
                {props.mode === "create"
                  ? "Cadastre um novo projeto em fase inicial."
                  : "Atualize as informações cadastrais e operacionais deste projeto."}
              </p>
            </div>
            {props.mode === "edit" && form.status_atual && <StatusBadge status={form.status_atual} />}
            <UrgenteBadge urgente={Boolean(form.urgente)} />
            {props.mode === "edit" && props.project && <PrazoBadge project={props.project} />}
            <button
              className="ml-1 shrink-0 rounded-lg border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel-soft p-2 text-zinc-500 dark:text-zinc-400 transition hover:border-zinc-300 dark:hover:border-white/15 hover:text-zinc-900 dark:hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e0b0f]/40"
              onClick={closeWithGuard}
              type="button"
              aria-label="Fechar formulário"
            >
              ✕
            </button>
          </div>
        </header>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={submit} className="space-y-4 p-5" id="project-form">
            {props.mode === "create" && props.quickMode && (
              <p className="rounded-xl border border-[#9e0b0f]/20 bg-[#9e0b0f]/5 px-3 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Cadastro simplificado ativo. Campos avançados podem ser ajustados depois no painel do projeto.
              </p>
            )}

            <SectionCard title="Identificação do Projeto">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Construtora" required error={construtoraError}>
                  <SearchableCombobox
                    value={form.construtora ?? ""}
                    options={construtoraOptions}
                    onChange={(value) => patch({ construtora: value, obra: "" })}
                    placeholder="Selecione a construtora"
                    searchPlaceholder="Buscar construtora..."
                    emptyMessage="Nenhuma construtora encontrada."
                    ariaLabel="Selecionar construtora"
                    error={construtoraError}
                  />
                </FormField>

                <FormField label="Obra" required error={obraError}>
                  <SearchableCombobox
                    value={form.obra ?? ""}
                    options={obraComboboxOptions}
                    onChange={(value) => patch({ obra: value })}
                    placeholder="Selecione a obra"
                    searchPlaceholder="Buscar obra..."
                    emptyMessage="Nenhuma obra encontrada."
                    ariaLabel="Selecionar obra"
                    error={obraError}
                  />
                </FormField>

                <FormField label="Código do Projeto" required error={duplicated ? "Código de projeto já existe." : ""}>
                  <input
                    className={modalInputCls(duplicated)}
                    placeholder="Codigo * (AAA-AAA-AAAA)"
                    value={form.codigo_projeto ?? ""}
                    onChange={(e) => patch({ codigo_projeto: formatProjectCode(e.target.value) })}
                  />
                </FormField>

                <FormField label="Vendedor" required>
                  <SearchableCombobox
                    value={form.vendedor ?? ""}
                    options={vendedorComboboxOptions}
                    onChange={(value) => patch({ vendedor: value })}
                    placeholder="Selecione o vendedor"
                    searchPlaceholder="Buscar vendedor..."
                    emptyMessage="Nenhum vendedor encontrado."
                    ariaLabel="Selecionar vendedor"
                  />
                </FormField>

                <FormField label="Equipamento" required>
                  <SearchableCombobox
                    value={form.equipamento ?? ""}
                    options={equipamentoComboboxOptions}
                    onChange={(value) => patch({ equipamento: value })}
                    placeholder="Selecione o equipamento"
                    searchPlaceholder="Buscar equipamento..."
                    emptyMessage="Nenhum equipamento encontrado."
                    ariaLabel="Selecionar equipamento"
                  />
                </FormField>

                <FormField label="Data de Lançamento" required>
                  <input
                    type="date"
                    className={modalInputCls()}
                    value={form.data_lancamento ?? ""}
                    onChange={(e) => patch({ data_lancamento: e.target.value })}
                  />
                </FormField>
              </div>
            </SectionCard>

            {!props.quickMode && (
              <SectionCard title="Contato Técnico">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="Engenheiro">
                    <input
                      className={modalInputCls()}
                      placeholder="Ex.: Luiz Freitas"
                      value={form.engenheiro_nome ?? ""}
                      onChange={(e) => patch({ engenheiro_nome: e.target.value })}
                      onBlur={(e) => patch({ engenheiro_nome: normalizeEngineerName(e.target.value) })}
                    />
                  </FormField>
                  <FormField label="Telefone do Engenheiro">
                    <input
                      className={modalInputCls()}
                      placeholder="(11) 99999-9999"
                      value={form.engenheiro_celular ?? ""}
                      onChange={(e) => patch({ engenheiro_celular: formatPhone(e.target.value) })}
                    />
                  </FormField>
                  <FormField label="Tipo de Cabine">
                    <SearchableCombobox
                      value={form.tipo_cabine ?? ""}
                      options={tipoCabineComboboxOptions}
                      onChange={(value) => patch({ tipo_cabine: value })}
                      placeholder="Selecione o tipo de cabine"
                      searchPlaceholder="Buscar tipo de cabine..."
                      emptyMessage="Nenhum tipo de cabine encontrado."
                      ariaLabel="Selecionar tipo de cabine"
                    />
                  </FormField>
                </div>
              </SectionCard>
            )}

            {!props.quickMode && (
              <SectionCard title="Alinhamento">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-3 transition hover:border-zinc-300 dark:hover:border-white/15">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 rounded accent-[#9e0b0f]" checked={Boolean(form.proj_obra_recebido)} onChange={(e) => patch({ proj_obra_recebido: e.target.checked })} />
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Projeto de obra recebido</span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-3 transition hover:border-zinc-300 dark:hover:border-white/15">
                    <input type="checkbox" className="mt-0.5 h-4 w-4 rounded accent-[#9e0b0f]" checked={Boolean(form.local_cabine_definido)} onChange={(e) => patch({ local_cabine_definido: e.target.checked })} />
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Local da cabine definido</span>
                  </label>
                  <div className={["sm:col-span-2", !prerequisitesReady && !form.alinhamento ? "opacity-60" : ""].join(" ")}>
                    <label className={["flex items-start gap-2.5 rounded-xl border p-3 transition", prerequisitesReady ? "cursor-pointer border-emerald-200 bg-emerald-50/50 dark:border-emerald-700/40 dark:bg-emerald-900/15 hover:border-emerald-300" : "cursor-not-allowed border-zinc-200 dark:border-white/8 bg-white dark:bg-panel"].join(" ")}>
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded accent-[#9e0b0f]"
                        checked={Boolean(form.alinhamento)}
                        disabled={!prerequisitesReady && !form.alinhamento}
                        onChange={(e) => {
                          if (e.target.checked) {
                            if (!prerequisitesReady) {
                              props.notify("Para concluir o alinhamento, confirme o recebimento do projeto e a definição do local da cabine.");
                              return;
                            }
                            setConfirmAlignmentOpen(true);
                            return;
                          }
                          if (form.status_atual !== "CADASTRO INICIAL") {
                            props.notify("Este projeto já foi liberado para elaboração de ante-projeto.");
                            return;
                          }
                          patch({ alinhamento: false, data_alinhamento: null });
                        }}
                      />
                      <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Alinhamento concluído</span>
                    </label>
                  </div>
                  {!prerequisitesReady && (
                    <p className="sm:col-span-2 rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft px-3 py-2 text-xs text-zinc-500 dark:text-muted">
                      Para concluir o alinhamento, confirme o recebimento do projeto e a definição do local da cabine.
                    </p>
                  )}
                  <FormField label="Data do Alinhamento">
                    <input type="date" className={modalInputCls()} value={form.data_alinhamento ?? ""} onChange={(e) => patch({ data_alinhamento: e.target.value || null })} />
                  </FormField>
                </div>
              </SectionCard>
            )}

            <SectionCard title={props.mode === "create" ? "Prioridade" : "Fluxo e Prioridade"}>
              <div className="grid gap-3 sm:grid-cols-2">
                {props.mode === "edit" && (
                  <SearchableCombobox
                    value={form.status_atual ?? "CADASTRO INICIAL"}
                    options={statusComboboxOptions}
                    onChange={(value) => patch({ status_atual: value as ProjectStatus })}
                    placeholder="Selecionar status"
                    searchPlaceholder="Buscar status..."
                    emptyMessage="Nenhum status encontrado."
                    ariaLabel="Selecionar status do projeto"
                  />
                )}
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel p-3 transition hover:border-zinc-300 dark:hover:border-white/15">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 rounded accent-[#9e0b0f]" checked={Boolean(form.urgente)} onChange={(e) => patch({ urgente: e.target.checked })} />
                  <div>
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Marcar como urgente</span>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-muted">Prioriza o projeto na fila de atendimento.</p>
                  </div>
                </label>
                {props.mode === "edit" && props.project && (
                  <button type="button" className="rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel-soft px-3 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-white/8" onClick={() => {
                    const result = props.onMoveStatus(props.project!.id, form.status_atual as ProjectStatus);
                    props.notify(result.ok ? "Status atualizado" : result.error ?? "Falha ao atualizar status");
                  }}>
                    Aplicar status atual
                  </button>
                )}
              </div>
            </SectionCard>

            {props.mode === "edit" && props.project && (
              <SectionCard title="Observações">
                <textarea
                  className="min-h-24 w-full rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-panel-soft dark:text-foreground p-3 text-sm outline-none transition focus:border-[#9e0b0f]"
                  value={obsText}
                  onChange={(e) => setObsText(e.target.value)}
                  placeholder="Registre informações relevantes, pendências, alinhamentos ou próximos passos."
                />
                <button
                  type="button"
                  className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-700"
                  onClick={() => {
                    props.onAddObservation(props.project!.id, obsText);
                    setObsText("");
                  }}
                >
                  Adicionar observação
                </button>
                <div className="space-y-1">
                  {props.observations.map((obs) => (
                    <div key={obs.id} className="rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft p-2.5 text-xs dark:text-zinc-300">
                      <strong>{obs.usuario}</strong> — {new Date(obs.criado_em).toLocaleString()}
                      <p className="mt-1 text-zinc-700 dark:text-zinc-300">{obs.texto}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {props.mode === "edit" && props.project && (
              <SectionCard title="Histórico de Status">
                <div className="space-y-1">
                  {props.statusHistory.map((item) => (
                    <div key={item.id} className="rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft p-2.5 text-xs">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{item.status_de ?? "(início)"}</span>
                      <span className="mx-1 text-zinc-400 dark:text-zinc-500">→</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{item.status_para}</span>
                      <span className="ml-2 text-zinc-500 dark:text-muted">• {item.origem} • {new Date(item.alterado_em).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}
          </form>
        </div>

        {/* Fixed footer */}
        <footer className="shrink-0 border-t border-zinc-200 dark:border-white/8 px-5 py-4">
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className="rounded-xl border border-zinc-300 dark:border-white/15 bg-white dark:bg-panel-soft px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-white/8" onClick={closeWithGuard}>Cancelar</button>
            {props.mode === "edit" && (
              <button type="button" className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700" onClick={requestDelete}>Excluir projeto</button>
            )}
            <button form="project-form" type="submit" className="rounded-xl bg-[#9e0b0f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7f090c]">
              {props.mode === "create" ? "Salvar projeto" : "Salvar alterações"}
            </button>
          </div>
        </footer>
      </div>

      {confirmAlignmentOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/45 p-4">
          <article className="w-full max-w-lg rounded-2xl border border-line bg-white dark:bg-panel p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-foreground">Confirmar alinhamento concluido?</h3>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Ao confirmar, este projeto sera liberado para a equipe de projetos e o status sera alterado automaticamente para &quot;ELABORAR ANTE-PROJETO&quot;. Essa acao indica que a documentacao e a localizacao da cabine ja foram validadas.
            </p>
            <footer className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setConfirmAlignmentOpen(false)} className="rounded-lg border border-line bg-white dark:bg-panel-soft px-4 py-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300 dark:hover:bg-white/8">
                Cancelar
              </button>
              <button type="button" onClick={confirmAlignment} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
                Confirmar e liberar projeto
              </button>
            </footer>
          </article>
        </div>
      )}

      <ConfirmProjectCreateDialog
        open={props.mode === "create" && confirmCreateOpen}
        projectData={{
          ...form,
          codigo_projeto: formatProjectCode(form.codigo_projeto ?? ""),
          engenheiro_nome: normalizeEngineerName(form.engenheiro_nome ?? ""),
        }}
        onReview={() => setConfirmCreateOpen(false)}
        onConfirmSave={confirmCreateSave}
        isSaving={isSavingCreate}
      />

      <MissingRequiredFieldsDialog
        open={missingRequiredOpen}
        fields={missingRequiredLabels}
        onClose={() => setMissingRequiredOpen(false)}
      />

    <UnsavedChangesDialog
      open={discardDialogOpen}
      onContinueEditing={() => setDiscardDialogOpen(false)}
      onConfirmDiscard={() => {
        setDiscardDialogOpen(false);
        props.onClose();
      }}
    />
    </div>
  );
}
