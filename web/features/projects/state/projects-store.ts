"use client";

import { create } from "zustand";
import { formatISO } from "date-fns";
import { buildSeedProjects } from "@/features/projects/domain/project-seed";
import {
  applyAlignmentAutomation,
  computePrazoBadge,
  computePrazoEntrega,
  todayIsoDate,
  transitionStatus,
  validateRequiredFields,
} from "@/features/projects/domain/project-rules";
import type {
  Project,
  ProjectObservation,
  ProjectStatus,
  StatusHistoryItem,
} from "@/features/projects/domain/project-types";

export type ProjectsView = "table" | "kanban" | "alerts";

type Filters = {
  search: string;
  status: "all" | ProjectStatus;
  construtora: string;
  vendedor: string;
  equipamento: string;
  atrasadoOnly: boolean;
  urgenteOnly: boolean;
};

type ProjectInput = Pick<
  Project,
  "construtora" | "obra" | "codigo_projeto" | "vendedor" | "equipamento" | "data_lancamento"
> &
  Partial<Project>;

type StoreState = {
  projects: Project[];
  observations: ProjectObservation[];
  statusHistory: StatusHistoryItem[];
  filters: Filters;
  activeView: ProjectsView;
  setActiveView: (view: ProjectsView) => void;
  setFilters: (patch: Partial<Filters>) => void;
  filteredProjects: () => Project[];
  alertProjects: () => Project[];
  createProject: (input: ProjectInput) => { ok: boolean; error?: string; missing?: string[] };
  updateProject: (id: string, patch: Partial<Project>) => { ok: boolean; error?: string };
  deleteProject: (id: string) => void;
  toggleUrgente: (id: string) => void;
  moveStatus: (id: string, nextStatus: ProjectStatus, origem: StatusHistoryItem["origem"]) => { ok: boolean; error?: string };
  addObservation: (projetoId: string, texto: string, usuario: string) => void;
  getProjectStatusHistory: (projectId: string) => StatusHistoryItem[];
  getProjectObservations: (projectId: string) => ProjectObservation[];
  isCodigoProjetoDuplicado: (codigo: string, ignoreId?: string) => boolean;
};

const nowDate = () => formatISO(new Date(), { representation: "date" });

function buildInitialHistory(projects: Project[]): StatusHistoryItem[] {
  return projects.map((project) => ({
    id: crypto.randomUUID(),
    projeto_id: project.id,
    status_de: null,
    status_para: project.status_atual,
    alterado_em: project.created_at,
    origem: "formulario",
  }));
}

function rankAlert(project: Project): number {
  if (project.urgente) return 0;
  const badge = computePrazoBadge(todayIsoDate(), computePrazoEntrega(project.data_alinhamento));
  if (badge === "atrasado") return 1;
  if (badge === "atencao") return 2;
  return 3;
}

const initialProjects = buildSeedProjects();

export const useProjectsStore = create<StoreState>((set, get) => ({
  projects: initialProjects,
  observations: [],
  statusHistory: buildInitialHistory(initialProjects),
  activeView: "table",
  filters: {
    search: "",
    status: "all",
    construtora: "",
    vendedor: "",
    equipamento: "",
    atrasadoOnly: false,
    urgenteOnly: false,
  },

  setActiveView: (activeView) => set({ activeView }),

  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),

  filteredProjects: () => {
    const { projects, filters } = get();
    const search = filters.search.trim().toLowerCase();

    return projects.filter((project) => {
      if (search) {
        const haystack = `${project.codigo_projeto} ${project.construtora} ${project.obra}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      if (filters.status !== "all" && project.status_atual !== filters.status) return false;
      if (filters.construtora && project.construtora !== filters.construtora) return false;
      if (filters.vendedor && project.vendedor !== filters.vendedor) return false;
      if (filters.equipamento && project.equipamento !== filters.equipamento) return false;
      if (filters.urgenteOnly && !project.urgente) return false;

      if (filters.atrasadoOnly) {
        const badge = computePrazoBadge(todayIsoDate(), computePrazoEntrega(project.data_alinhamento));
        if (badge !== "atrasado") return false;
      }

      return true;
    });
  },

  alertProjects: () => {
    const projects = get().filteredProjects();
    return [...projects].sort((a, b) => {
      const ra = rankAlert(a);
      const rb = rankAlert(b);
      if (ra !== rb) return ra - rb;
      return a.codigo_projeto.localeCompare(b.codigo_projeto);
    });
  },

  isCodigoProjetoDuplicado: (codigo, ignoreId) => {
    const code = codigo.trim().toLowerCase();
    return get().projects.some(
      (project) => project.codigo_projeto.trim().toLowerCase() === code && project.id !== ignoreId,
    );
  },

  createProject: (input) => {
    const missing = validateRequiredFields(input);
    if (missing.length > 0) {
      return { ok: false, missing, error: "Campos obrigatorios ausentes." };
    }

    if (get().isCodigoProjetoDuplicado(input.codigo_projeto)) {
      return { ok: false, error: "Codigo de projeto ja cadastrado." };
    }

    const now = nowDate();
    const next: Project = {
      id: crypto.randomUUID(),
      construtora: input.construtora,
      obra: input.obra,
      engenheiro_nome: input.engenheiro_nome ?? "",
      engenheiro_celular: input.engenheiro_celular ?? "",
      equipamento: input.equipamento,
      tipo_cabine: input.tipo_cabine ?? "",
      codigo_projeto: input.codigo_projeto,
      vendedor: input.vendedor,
      proj_obra_recebido: input.proj_obra_recebido ?? false,
      local_cabine_definido: input.local_cabine_definido ?? false,
      alinhamento: input.alinhamento ?? false,
      data_lancamento: input.data_lancamento,
      data_alinhamento: input.data_alinhamento ?? null,
      status_atual: "ELABORAR ANTE-PROJETO",
      data_previsao: input.data_previsao ?? null,
      data_envio: null,
      data_aprovacao: null,
      data_prazo_ap: input.data_prazo_ap ?? null,
      variacao_cabine: input.variacao_cabine ?? "",
      projeto_base: input.projeto_base ?? "",
      aprovacao_final: input.aprovacao_final ?? false,
      local_cabine_final: input.local_cabine_final ?? false,
      data_final: input.data_final ?? null,
      urgente: input.urgente ?? false,
      created_at: now,
      updated_at: now,
    };

    const alignment = applyAlignmentAutomation({
      proj_obra_recebido: next.proj_obra_recebido,
      local_cabine_definido: next.local_cabine_definido,
      alinhamento: next.alinhamento,
      data_alinhamento: next.data_alinhamento,
    });

    if (alignment.alinhamentoSuggested) {
      next.alinhamento = true;
      next.data_alinhamento = alignment.nextDataAlinhamento;
    }

    set((state) => ({
      projects: [next, ...state.projects],
      statusHistory: [
        {
          id: crypto.randomUUID(),
          projeto_id: next.id,
          status_de: null,
          status_para: next.status_atual,
          alterado_em: now,
          origem: "formulario",
        },
        ...state.statusHistory,
      ],
    }));

    return { ok: true };
  },

  updateProject: (id, patch) => {
    const current = get().projects.find((project) => project.id === id);
    if (!current) return { ok: false, error: "Projeto nao encontrado." };

    if (
      typeof patch.codigo_projeto === "string" &&
      get().isCodigoProjetoDuplicado(patch.codigo_projeto, id)
    ) {
      return { ok: false, error: "Codigo de projeto ja cadastrado." };
    }

    const merged = { ...current, ...patch } as Project;
    const alignment = applyAlignmentAutomation({
      proj_obra_recebido: merged.proj_obra_recebido,
      local_cabine_definido: merged.local_cabine_definido,
      alinhamento: merged.alinhamento,
      data_alinhamento: merged.data_alinhamento,
    });

    if (alignment.alinhamentoSuggested) {
      merged.alinhamento = true;
      if (!merged.data_alinhamento) merged.data_alinhamento = alignment.nextDataAlinhamento;
    }

    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === id ? { ...merged, updated_at: nowDate() } : project,
      ),
    }));

    return { ok: true };
  },

  deleteProject: (id) => {
    set((state) => ({
      projects: state.projects.filter((project) => project.id !== id),
      observations: state.observations.filter((obs) => obs.projeto_id !== id),
      statusHistory: state.statusHistory.filter((h) => h.projeto_id !== id),
    }));
  },

  toggleUrgente: (id) => {
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === id ? { ...project, urgente: !project.urgente, updated_at: nowDate() } : project,
      ),
    }));
  },

  moveStatus: (id, nextStatus, origem) => {
    const current = get().projects.find((project) => project.id === id);
    if (!current) return { ok: false, error: "Projeto nao encontrado." };

    let side;
    try {
      side = transitionStatus({
        currentStatus: current.status_atual,
        nextStatus,
        aligned: current.alinhamento,
        today: nowDate(),
        data_envio: current.data_envio,
        data_aprovacao: current.data_aprovacao,
      });
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Erro de transicao." };
    }

    const now = nowDate();

    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === id
          ? {
              ...project,
              status_atual: nextStatus,
              data_envio: side.data_envio,
              data_aprovacao: side.data_aprovacao,
              updated_at: now,
            }
          : project,
      ),
      statusHistory: [
        {
          id: crypto.randomUUID(),
          projeto_id: id,
          status_de: current.status_atual,
          status_para: nextStatus,
          alterado_em: now,
          origem,
        },
        ...state.statusHistory,
      ],
    }));

    return { ok: true };
  },

  addObservation: (projetoId, texto, usuario) => {
    const message = texto.trim();
    if (!message) return;
    set((state) => ({
      observations: [
        {
          id: crypto.randomUUID(),
          projeto_id: projetoId,
          usuario,
          texto: message,
          criado_em: formatISO(new Date()),
        },
        ...state.observations,
      ],
    }));
  },

  getProjectStatusHistory: (projectId) =>
    get()
      .statusHistory.filter((item) => item.projeto_id === projectId)
      .sort((a, b) => (a.alterado_em < b.alterado_em ? 1 : -1)),

  getProjectObservations: (projectId) =>
    get()
      .observations.filter((item) => item.projeto_id === projectId)
      .sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1)),
}));
