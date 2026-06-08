"use client";

import { create } from "zustand";
import { formatISO } from "date-fns";
import {
  getCurrentStatusDeadline,
  validateRequiredFields,
  validateStatusTransition,
} from "@/features/projects/domain/project-rules";
import type {
  Project,
  ProjectObservation,
  ProjectStatus,
  ReviewHistoryItem,
  FinalReviewHistoryItem,
  StatusHistoryItem,
} from "@/features/projects/domain/project-types";
import {
  apiAddObservation,
  apiChangeStatus,
  apiCreateProject,
  apiListProjects,
  apiSetUrgency,
  apiUpdateProject,
} from "@/features/projects/lib/projects-api";

// Persistência em background: cada mutação otimista local dispara a chamada à API
// (MySQL é a fonte da verdade) e re-hidrata o estado a partir do banco.
function logApiError(action: string) {
  return (e: unknown) => console.error(`[projects] falha ao persistir ${action}:`, e);
}

// Em caso de falha da API, reidrata do MySQL para reverter a alteração otimista
// (ex.: rollback do card no Kanban quando /status falha). Falha de NOTIFICAÇÃO
// não passa por aqui — ela é independente e nunca desfaz o status já salvo.
function onPersistFailure(action: string) {
  return (e: unknown) => {
    logApiError(action)(e);
    void useProjectsStore.getState().hydrate();
  };
}

export type ProjectsView = "table" | "kanban" | "kpis" | "alerts";

type Filters = {
  search: string;
  status: "all" | ProjectStatus;
  construtora: string;
  obra: string;
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
  createProject: (input: ProjectInput) => { ok: boolean; error?: string; missing?: string[]; project?: Project };
  updateProject: (id: string, patch: Partial<Project>) => { ok: boolean; error?: string };
  deleteProject: (id: string) => void;
  toggleUrgente: (id: string) => void;
  moveStatus: (id: string, nextStatus: ProjectStatus, origem: StatusHistoryItem["origem"], nota?: string) => { ok: boolean; error?: string };
  addObservation: (projetoId: string, texto: string, usuario: string) => void;
  getProjectStatusHistory: (projectId: string) => StatusHistoryItem[];
  getProjectObservations: (projectId: string) => ProjectObservation[];
  isCodigoProjetoDuplicado: (codigo: string, ignoreId?: string) => boolean;
  /** Recarrega os projetos a partir do MySQL (fonte da verdade). */
  hydrate: () => Promise<void>;
};

const nowDate = () => formatISO(new Date(), { representation: "date" });

function buildInitialHistory(projects: Project[]): StatusHistoryItem[] {
  return projects.map((project) => ({
    id: crypto.randomUUID(),
    projeto_id: project.id,
    status_de: null,
    status_para: project.status_atual,
    alterado_em: project.status_entered_at,
    origem: "formulario" as const,
    nota: "Historico inicial gerado pelo seed",
  }));
}

function rankAlert(project: Project): number {
  if (project.urgente) return 0;
  const deadline = getCurrentStatusDeadline(project);
  if (deadline.isOverdue) return 1;
  if (deadline.hasDeadline && (deadline.daysRemaining ?? 999) <= 15) return 2;
  return 3;
}

// Base inicia VAZIA — sem dados mockados. Projetos reais virão da integração MySQL.
const initialProjects: Project[] = [];

export const useProjectsStore = create<StoreState>((set, get) => ({
  projects: initialProjects,
  observations: [],
  statusHistory: buildInitialHistory(initialProjects),
  activeView: "table",
  filters: {
    search: "",
    status: "all",
    construtora: "",
    obra: "",
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
      if (filters.obra && project.obra !== filters.obra) return false;
      if (filters.vendedor && project.vendedor !== filters.vendedor) return false;
      if (filters.equipamento && project.equipamento !== filters.equipamento) return false;
      if (filters.urgenteOnly && !project.urgente) return false;

      if (filters.atrasadoOnly) {
        const deadline = getCurrentStatusDeadline(project);
        if (!deadline.isOverdue) return false;
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

    // Regra: se alinhamento completo no cadastro, entra direto em ELABORAR ANTE-PROJETO
    const alignmentComplete =
      (input.proj_obra_recebido ?? false) &&
      (input.local_cabine_definido ?? false) &&
      (input.alinhamento ?? false);

    const initialStatus: ProjectStatus = alignmentComplete ? "ELABORAR ANTE-PROJETO" : "CADASTRO INICIAL";
    const statusEnteredAt = alignmentComplete
      ? (input.data_alinhamento ?? now)
      : now;

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
      status_atual: initialStatus,
      status_entered_at: statusEnteredAt,
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
      reviewCount: 0,
      reviewHistory: [],
      finalReviewCount: 0,
      finalReviewHistory: [],
      created_at: now,
      updated_at: now,
    };

    const historyEntries: StatusHistoryItem[] = [];

    if (alignmentComplete) {
      // Registra as duas entradas: CADASTRO INICIAL (instantâneo) + ELABORAR ANTE-PROJETO
      historyEntries.push({
        id: crypto.randomUUID(),
        projeto_id: next.id,
        status_de: null,
        status_para: "CADASTRO INICIAL",
        alterado_em: now,
        origem: "formulario",
        nota: "Projeto cadastrado",
      });
      historyEntries.push({
        id: crypto.randomUUID(),
        projeto_id: next.id,
        status_de: "CADASTRO INICIAL",
        status_para: "ELABORAR ANTE-PROJETO",
        alterado_em: statusEnteredAt,
        origem: "sistema",
        nota: "Projeto cadastrado com alinhamento concluido e liberado automaticamente para Elaborar Ante-Projeto.",
      });
    } else {
      historyEntries.push({
        id: crypto.randomUUID(),
        projeto_id: next.id,
        status_de: null,
        status_para: "CADASTRO INICIAL",
        alterado_em: now,
        origem: "formulario",
        nota: "Projeto cadastrado",
      });
    }

    set((state) => ({
      projects: [next, ...state.projects],
      statusHistory: [...historyEntries, ...state.statusHistory],
    }));

    // Persiste no MySQL e substitui APENAS o registro otimista pelo real
    // (sem refetch da lista inteira — evita lentidão e "card voltando").
    void apiCreateProject(input)
      .then((real) =>
        set((state) => ({
          projects: state.projects.map((p) => (p.codigo_projeto === real.codigo_projeto ? real : p)),
        })),
      )
      .catch(onPersistFailure("criação de projeto"));

    return { ok: true, project: next };
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

    if (current.status_atual !== "CADASTRO INICIAL" && merged.status_atual === "CADASTRO INICIAL") {
      return {
        ok: false,
        error:
          "Este projeto ja foi liberado para elaboracao de anteprojeto e nao pode retornar automaticamente para a fase inicial.",
      };
    }

    const now = nowDate();
    const statusChanged = current.status_atual !== merged.status_atual;

    // Atualiza status_entered_at quando o status muda
    if (statusChanged) {
      merged.status_entered_at = now;
    }

    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === id ? { ...merged, updated_at: now } : project,
      ),
      statusHistory: statusChanged
        ? [
            {
              id: crypto.randomUUID(),
              projeto_id: id,
              status_de: current.status_atual,
              status_para: merged.status_atual,
              alterado_em: now,
              origem: "formulario" as const,
            },
            ...state.statusHistory,
          ]
        : state.statusHistory,
    }));

    // Persiste no MySQL e funde só este projeto (sem refetch da lista).
    const applyUpdated = (real: Project) =>
      set((state) => ({ projects: state.projects.map((p) => (p.id === id ? real : p)) }));
    void apiUpdateProject(id, merged)
      .then((real) =>
        statusChanged
          ? apiChangeStatus(id, merged.status_atual, { source: "formulario" }).then(applyUpdated)
          : applyUpdated(real),
      )
      .catch(onPersistFailure("edição de projeto"));

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
    const willBeUrgent = !get().projects.find((p) => p.id === id)?.urgente;
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === id ? { ...project, urgente: !project.urgente, updated_at: nowDate() } : project,
      ),
    }));
    void apiSetUrgency(id, willBeUrgent)
      .then((real) => set((state) => ({ projects: state.projects.map((p) => (p.id === id ? real : p)) })))
      .catch(onPersistFailure("urgência"));
  },

  moveStatus: (id, nextStatus, origem, nota) => {
    const current = get().projects.find((project) => project.id === id);
    if (!current) return { ok: false, error: "Projeto nao encontrado." };

    const validation = validateStatusTransition(current, nextStatus);
    if (!validation.allowed) {
      return { ok: false, error: validation.reason ?? "Transicao de status nao permitida." };
    }

    const now = nowDate();

    // Campos derivados da transição
    const data_envio =
      nextStatus === "ANTE-PROJETO ENVIADO" && !current.data_envio
        ? now
        : current.data_envio;
    const data_aprovacao =
      nextStatus === "ANTE-PROJETO APROVADO" && !current.data_aprovacao
        ? now
        : current.data_aprovacao;

    // Rastrear revisão de estudo
    const enteringReview = nextStatus === "REVISAO DE ESTUDO";
    const exitingReview = current.status_atual === "REVISAO DE ESTUDO";

    let updatedReviewHistory = [...(current.reviewHistory ?? [])];
    let reviewCount = current.reviewCount;

    if (exitingReview) {
      updatedReviewHistory = updatedReviewHistory.map((item, index) =>
        index === updatedReviewHistory.length - 1 && item.exitedAt === null
          ? { ...item, exitedAt: now }
          : item,
      );
    }

    if (enteringReview) {
      reviewCount += 1;
      const newReview: ReviewHistoryItem = {
        id: crypto.randomUUID(),
        enteredAt: now,
        exitedAt: null,
        reason: nota?.trim() || "Sem motivo informado",
        changedBy: "usuario.local",
      };
      updatedReviewHistory = [...updatedReviewHistory, newReview];
    }

    // Rastrear revisão de projeto final
    const enteringFinalReview = nextStatus === "REVISAO DE PROJETO FINAL";
    const exitingFinalReview = current.status_atual === "REVISAO DE PROJETO FINAL";

    let updatedFinalReviewHistory = [...(current.finalReviewHistory ?? [])];
    let finalReviewCount = current.finalReviewCount;

    if (exitingFinalReview) {
      updatedFinalReviewHistory = updatedFinalReviewHistory.map((item, index) =>
        index === updatedFinalReviewHistory.length - 1 && item.exitedAt === null
          ? { ...item, exitedAt: now }
          : item,
      );
    }

    if (enteringFinalReview) {
      finalReviewCount += 1;
      const newFinalReview: FinalReviewHistoryItem = {
        id: crypto.randomUUID(),
        enteredAt: now,
        exitedAt: null,
        reason: nota?.trim() || "Sem motivo informado",
        changedBy: "usuario.local",
      };
      updatedFinalReviewHistory = [...updatedFinalReviewHistory, newFinalReview];
    }

    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === id
          ? {
              ...project,
              status_atual: nextStatus,
              status_entered_at: now,
              data_envio,
              data_aprovacao,
              reviewCount,
              reviewHistory: updatedReviewHistory,
              finalReviewCount,
              finalReviewHistory: updatedFinalReviewHistory,
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
          nota: nota?.trim() || undefined,
        },
        ...state.statusHistory,
      ],
    }));

    void apiChangeStatus(id, nextStatus, { source: origem, reason: nota, note: nota })
      .then((real) => set((state) => ({ projects: state.projects.map((p) => (p.id === id ? real : p)) })))
      .catch(onPersistFailure("mudança de status"));

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
    // Persiste a observação (ignora se o id ainda for otimista — será reconciliado).
    void apiAddObservation(projetoId, message).catch(logApiError("observação"));
  },

  getProjectStatusHistory: (projectId) =>
    get()
      .statusHistory.filter((item) => item.projeto_id === projectId)
      .sort((a, b) => (a.alterado_em < b.alterado_em ? 1 : -1)),

  getProjectObservations: (projectId) =>
    get()
      .observations.filter((item) => item.projeto_id === projectId)
      .sort((a, b) => (a.criado_em < b.criado_em ? 1 : -1)),

  hydrate: async () => {
    try {
      const projects = await apiListProjects();
      set({ projects });
    } catch (e) {
      logApiError("listagem de projetos")(e);
    }
  },
}));
