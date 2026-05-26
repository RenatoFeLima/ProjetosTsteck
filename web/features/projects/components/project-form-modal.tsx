"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { todayIsoDate, validateRequiredFields } from "@/features/projects/domain/project-rules";
import type { Project, ProjectStatus, StatusHistoryItem } from "@/features/projects/domain/project-types";
import { PrazoBadge, StatusBadge, UrgenteBadge } from "./pill-badges";

const STATUS_OPTIONS: ProjectStatus[] = [
  "ELABORAR ANTE-PROJETO",
  "ANTE-PROJETO ENVIADO",
  "ANTE-PROJETO APROVADO",
  "PROJETO APROVADO",
  "PROJETO FINAL ENVIADO",
  "REVISAO DE ESTUDO",
];

type ProjectFormModalProps = {
  open: boolean;
  mode: "create" | "edit";
  project?: Project;
  statusHistory: StatusHistoryItem[];
  observations: Array<{ id: string; usuario: string; texto: string; criado_em: string }>;
  onClose: () => void;
  onCreate: (input: Partial<Project>) => { ok: boolean; error?: string; missing?: string[] };
  onUpdate: (id: string, patch: Partial<Project>) => { ok: boolean; error?: string };
  onDelete: (id: string) => void;
  onToggleUrgente: (id: string) => void;
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
    status_atual: "ELABORAR ANTE-PROJETO",
    data_envio: null,
    data_aprovacao: null,
    urgente: false,
  };
}

export function ProjectFormModal(props: ProjectFormModalProps) {
  const [form, setForm] = useState<Partial<Project>>(blankProject());
  const [dirty, setDirty] = useState(false);
  const [obsText, setObsText] = useState("");

  useEffect(() => {
    if (!props.open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm(props.mode === "edit" && props.project ? props.project : blankProject());
    setDirty(false);
    setObsText("");
  }, [props.open, props.mode, props.project]);

  const duplicated = useMemo(() => {
    if (!form.codigo_projeto) return false;
    return props.isCodigoDuplicado(form.codigo_projeto, props.project?.id);
  }, [form.codigo_projeto, props]);

  if (!props.open) return null;

  function patch(next: Partial<Project>) {
    const merged = { ...form, ...next };

    if (merged.proj_obra_recebido && merged.local_cabine_definido) {
      merged.alinhamento = true;
      if (!merged.data_alinhamento) {
        merged.data_alinhamento = todayIsoDate();
      }
    }

    setForm(merged);
    setDirty(true);
  }

  function closeWithGuard() {
    if (dirty && !window.confirm("Descartar alteracoes nao salvas?")) return;
    props.onClose();
  }

  function submit(event: FormEvent) {
    event.preventDefault();

    const missing = validateRequiredFields(form as Project);
    if (missing.length > 0) {
      props.notify(`Campos obrigatorios: ${missing.join(", ")}`);
      return;
    }

    if (duplicated) {
      props.notify("Codigo de projeto duplicado.");
      return;
    }

    if (props.mode === "create") {
      const result = props.onCreate(form);
      if (!result.ok) {
        props.notify(result.error ?? "Falha ao criar projeto");
        return;
      }
      props.notify("Projeto criado com sucesso");
      props.onClose();
      return;
    }

    if (!props.project) return;
    const result = props.onUpdate(props.project.id, form);
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

  return (
    <div className="fixed inset-0 z-50 bg-black/40">
      <div className="h-full w-full overflow-y-auto bg-white p-4 md:mx-auto md:my-8 md:h-[85vh] md:max-w-6xl md:rounded-2xl md:p-6">
        <header className="mb-4 flex flex-wrap items-center gap-2 border-b border-zinc-200 pb-3">
          <h2 className="text-lg font-bold">
            {props.mode === "create" ? "Novo Projeto" : form.codigo_projeto || "Detalhe do Projeto"}
          </h2>
          {form.status_atual && <StatusBadge status={form.status_atual} />}
          <UrgenteBadge urgente={Boolean(form.urgente)} />
          {props.mode === "edit" && props.project && <PrazoBadge project={props.project} />}
          <button className="ml-auto rounded-lg border px-3 py-1 text-sm" onClick={closeWithGuard} type="button">
            Fechar
          </button>
        </header>

        <form onSubmit={submit} className="grid gap-4">
          <section className="grid gap-2 rounded-2xl border border-zinc-200 p-3 md:grid-cols-2">
            <h3 className="md:col-span-2 text-sm font-bold">Identificacao</h3>
            <input className="rounded-lg border p-2" placeholder="Construtora *" value={form.construtora ?? ""} onChange={(e) => patch({ construtora: e.target.value })} />
            <input className="rounded-lg border p-2" placeholder="Obra *" value={form.obra ?? ""} onChange={(e) => patch({ obra: e.target.value })} />
            <input className="rounded-lg border p-2" placeholder="Codigo *" value={form.codigo_projeto ?? ""} onChange={(e) => patch({ codigo_projeto: e.target.value })} />
            <input className="rounded-lg border p-2" placeholder="Vendedor *" value={form.vendedor ?? ""} onChange={(e) => patch({ vendedor: e.target.value })} />
            <input className="rounded-lg border p-2" placeholder="Equipamento *" value={form.equipamento ?? ""} onChange={(e) => patch({ equipamento: e.target.value })} />
            <input className="rounded-lg border p-2" type="date" value={form.data_lancamento ?? ""} onChange={(e) => patch({ data_lancamento: e.target.value })} />
            <input className="rounded-lg border p-2" placeholder="Engenheiro (opcional)" value={form.engenheiro_nome ?? ""} onChange={(e) => patch({ engenheiro_nome: e.target.value })} />
            <input className="rounded-lg border p-2" placeholder="Celular (opcional)" value={form.engenheiro_celular ?? ""} onChange={(e) => patch({ engenheiro_celular: e.target.value })} />
            <input className="rounded-lg border p-2" placeholder="Tipo cabine (opcional)" value={form.tipo_cabine ?? ""} onChange={(e) => patch({ tipo_cabine: e.target.value })} />
            {duplicated && <p className="md:col-span-2 text-sm font-semibold text-red-600">Codigo de projeto ja existe no estado local.</p>}
          </section>

          <section className="grid gap-2 rounded-2xl border border-zinc-200 p-3 md:grid-cols-2">
            <h3 className="md:col-span-2 text-sm font-bold">Alinhamento</h3>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={Boolean(form.proj_obra_recebido)} onChange={(e) => patch({ proj_obra_recebido: e.target.checked })} />
              Projeto de obra recebido
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={Boolean(form.local_cabine_definido)} onChange={(e) => patch({ local_cabine_definido: e.target.checked })} />
              Local da cabine definido
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={Boolean(form.alinhamento)} onChange={(e) => patch({ alinhamento: e.target.checked })} />
              Alinhamento concluido
            </label>
            <input type="date" className="rounded-lg border p-2" value={form.data_alinhamento ?? ""} onChange={(e) => patch({ data_alinhamento: e.target.value || null })} />
          </section>

          <section className="grid gap-2 rounded-2xl border border-zinc-200 p-3 md:grid-cols-2">
            <h3 className="md:col-span-2 text-sm font-bold">Fluxo e prioridade</h3>
            <select
              className="rounded-lg border p-2"
              value={form.status_atual}
              onChange={(e) => patch({ status_atual: e.target.value as ProjectStatus })}
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={Boolean(form.urgente)} onChange={(e) => patch({ urgente: e.target.checked })} />
              Marcar como urgente
            </label>
            {props.mode === "edit" && props.project && (
              <div className="md:col-span-2 flex flex-wrap gap-2">
                <button type="button" className="rounded-lg border px-3 py-1" onClick={() => props.onToggleUrgente(props.project!.id)}>
                  Alternar urgente
                </button>
                <button
                  type="button"
                  className="rounded-lg border px-3 py-1"
                  onClick={() => {
                    const result = props.onMoveStatus(props.project!.id, form.status_atual as ProjectStatus);
                    props.notify(result.ok ? "Status atualizado" : result.error ?? "Falha ao atualizar status");
                  }}
                >
                  Aplicar status atual
                </button>
              </div>
            )}
          </section>

          {props.mode === "edit" && props.project && (
            <section className="grid gap-2 rounded-2xl border border-zinc-200 p-3 md:grid-cols-2">
              <h3 className="md:col-span-2 text-sm font-bold">Observacoes</h3>
              <textarea
                className="md:col-span-2 min-h-24 rounded-lg border p-2"
                value={obsText}
                onChange={(e) => setObsText(e.target.value)}
                placeholder="Adicionar observacao"
              />
              <button
                type="button"
                className="w-fit rounded-lg bg-zinc-900 px-3 py-1.5 text-white"
                onClick={() => {
                  props.onAddObservation(props.project!.id, obsText);
                  setObsText("");
                }}
              >
                Adicionar observacao
              </button>
              <div className="md:col-span-2 space-y-1">
                {props.observations.map((obs) => (
                  <div key={obs.id} className="rounded-lg bg-zinc-50 p-2 text-xs">
                    <strong>{obs.usuario}</strong> - {new Date(obs.criado_em).toLocaleString()}
                    <p>{obs.texto}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {props.mode === "edit" && props.project && (
            <section className="grid gap-2 rounded-2xl border border-zinc-200 p-3">
              <h3 className="text-sm font-bold">Historico de status</h3>
              {props.statusHistory.map((item) => (
                <div key={item.id} className="rounded-lg bg-zinc-50 p-2 text-xs">
                  {item.status_de ?? "(inicio)"}
                  {" -> "}
                  {item.status_para}
                  {" | "}
                  {item.origem}
                  {" | "}
                  {new Date(item.alterado_em).toLocaleString()}
                </div>
              ))}
            </section>
          )}

          <footer className="flex flex-wrap gap-2">
            <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-white">Salvar</button>
            {props.mode === "edit" && (
              <button type="button" className="rounded-lg bg-red-600 px-4 py-2 text-white" onClick={requestDelete}>Excluir</button>
            )}
            <button type="button" className="rounded-lg border px-4 py-2" onClick={closeWithGuard}>Cancelar</button>
          </footer>
        </form>
      </div>
    </div>
  );
}
