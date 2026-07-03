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
  apiGetAnalytics,
  apiGetHistory,
  apiListProjects,
  apiSetUrgency,
  apiUpdateProject,
  type ReviewAggItem,
} from "@/features/projects/lib/projects-api";
import type { ProjectReminder } from "@/features/projects/domain/project-reminders";
import {
  apiCreateReminder,
  apiListReminders,
  apiPostponeReminder,
  apiRemoveReminder,
  apiResolveReminder,
  apiUpdateReminder,
  type ReminderCreatePayload,
} from "@/features/projects/lib/reminders-api";

// ─── Persistência em background + reconciliação de IDs otimistas ──────────────
// Cada mutação otimista local dispara a chamada à API (MySQL é a fonte da verdade).
// Projetos recém-criados recebem um id temporário (client-side). Enquanto não são
// persistidos, ficam registrados aqui para que ações secundárias NÃO disparem
// requests com id inexistente — o que geraria 404 "Projeto não encontrado".
const pendingCreateIds = new Set<string>();
const isPending = (id: string) => pendingCreateIds.has(id);

// Canal para reportar erros de AÇÃO REAL do usuário à UI sem acoplar o store ao
// React (a shell registra um handler que exibe um toast). Tentativas secundárias
// não-críticas não passam por aqui — ficam apenas em debug, sem poluir o DevTools.
let errorSink: ((message: string) => void) | null = null;
export function setProjectsErrorSink(fn: ((message: string) => void) | null) {
  errorSink = fn;
}
function reportUserError(message: string) {
  errorSink?.(message);
}

// Logger controlado: ruído conhecido (tentativas secundárias) fica em debug e
// some em produção; logs úteis ficam no backend/Vercel.
function debugLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") console.debug("[projects]", ...args);
}

function messageFrom(e: unknown, fallback: string): string {
  const msg = e instanceof Error ? e.message.trim() : "";
  return msg && msg !== "Erro na requisição." ? msg : fallback;
}

// Falha de uma AÇÃO REAL: reidrata do MySQL para reverter a alteração otimista
// (ex.: rollback do card no Kanban quando /status falha) e informa o usuário.
// Falha de NOTIFICAÇÃO não passa por aqui — é independente e nunca desfaz o status.
function onPersistFailure(action: string, friendly: string) {
  return (e: unknown) => {
    debugLog(`falha ao persistir ${action}`, e);
    reportUserError(messageFrom(e, friendly));
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
  /** Lembretes operacionais de todos os projetos visíveis (fonte: MySQL). */
  reminders: ProjectReminder[];
  /** Revisões agregadas (todos os projetos) — base dos SLAs de revisão nos KPIs. */
  reviewStudyAgg: ReviewAggItem[];
  finalReviewAgg: ReviewAggItem[];
  filters: Filters;
  activeView: ProjectsView;
  setActiveView: (view: ProjectsView) => void;
  setFilters: (patch: Partial<Filters>) => void;
  filteredProjects: () => Project[];
  alertProjects: () => Project[];
  createProject: (input: ProjectInput) => { ok: boolean; error?: string; missing?: string[]; project?: Project };
  updateProject: (id: string, patch: Partial<Project>) => Promise<{ ok: boolean; error?: string }>;
  deleteProject: (id: string) => void;
  toggleUrgente: (id: string, urgentData?: { reason: string; deadline: string }) => void;
  moveStatus: (id: string, nextStatus: ProjectStatus, origem: StatusHistoryItem["origem"], nota?: string, finalCode?: string) => { ok: boolean; error?: string };
  addObservation: (projetoId: string, texto: string, usuario: string) => void;
  getProjectStatusHistory: (projectId: string) => StatusHistoryItem[];
  getProjectObservations: (projectId: string) => ProjectObservation[];
  isCodigoProjetoDuplicado: (codigo: string, ignoreId?: string) => boolean;
  /** Recarrega os projetos a partir do MySQL (fonte da verdade). */
  hydrate: () => Promise<void>;
  /** Carrega os lembretes operacionais do MySQL. */
  loadReminders: () => Promise<void>;
  createReminder: (projectId: string, input: ReminderCreatePayload) => Promise<{ ok: boolean; error?: string }>;
  updateReminder: (
    id: string,
    patch: Partial<ReminderCreatePayload> & { proxima_data?: string },
  ) => Promise<{ ok: boolean; error?: string }>;
  postponeReminder: (id: string, date: string) => void;
  resolveReminder: (id: string) => void;
  removeReminder: (id: string) => void;
  /** Carrega histórico + observações reais de um projeto do MySQL (ao abrir o drawer). */
  loadProjectDetail: (id: string) => Promise<void>;
  /** Carrega dados agregados de TODOS os projetos (histórico + revisões) p/ KPIs. */
  loadAnalytics: () => Promise<void>;
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
  reminders: [],
  reviewStudyAgg: [],
  finalReviewAgg: [],
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

    // Persiste no MySQL e reconcilia o id temporário pelo id REAL devolvido pelo
    // backend — em projetos, histórico e observações — para que nenhuma ação
    // posterior use o id antigo. Sem refetch da lista inteira.
    const tempId = next.id;
    pendingCreateIds.add(tempId);
    void apiCreateProject(input)
      .then((real) => {
        pendingCreateIds.delete(tempId);
        set((state) => ({
          projects: state.projects.map((p) => (p.id === tempId ? real : p)),
          statusHistory: state.statusHistory.map((h) =>
            h.projeto_id === tempId ? { ...h, projeto_id: real.id } : h,
          ),
          observations: state.observations.map((o) =>
            o.projeto_id === tempId ? { ...o, projeto_id: real.id } : o,
          ),
        }));
      })
      .catch((e) => {
        pendingCreateIds.delete(tempId);
        // Criação real falhou (ex.: validação 400/409). Remove o registro otimista
        // e informa o usuário — sem console.error genérico poluindo o DevTools.
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== tempId),
          statusHistory: state.statusHistory.filter((h) => h.projeto_id !== tempId),
          observations: state.observations.filter((o) => o.projeto_id !== tempId),
        }));
        debugLog("falha ao criar projeto", e);
        reportUserError(messageFrom(e, "Não foi possível salvar o projeto."));
      });

    return { ok: true, project: next };
  },

  updateProject: async (id, patch) => {
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

    if (statusChanged) {
      merged.status_entered_at = now;
    }

    // Atualiza otimisticamente para feedback imediato na UI
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

    // Projeto ainda não persistido: não há id real no banco para editar.
    if (isPending(id)) {
      debugLog("edição adiada: projeto ainda não persistido", id);
      return { ok: true };
    }

    // Persiste no MySQL e aguarda a resposta real (o caller deve await isso).
    try {
      const applyUpdated = (real: Project) =>
        set((state) => ({ projects: state.projects.map((p) => (p.id === id ? real : p)) }));
      const real = await apiUpdateProject(id, merged);
      if (statusChanged) {
        const statusReal = await apiChangeStatus(id, merged.status_atual, { source: "formulario" });
        applyUpdated(statusReal);
      } else {
        applyUpdated(real);
      }
      return { ok: true };
    } catch (e) {
      // Reverte o optimistic update e informa o erro
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? { ...current, updated_at: now } : p)),
        statusHistory: statusChanged
          ? state.statusHistory.filter((h) => !(h.projeto_id === id && h.alterado_em === now))
          : state.statusHistory,
      }));
      const msg = messageFrom(e, "Não foi possível salvar as alterações do projeto.");
      reportUserError(msg);
      return { ok: false, error: msg };
    }
  },

  deleteProject: (id) => {
    set((state) => ({
      projects: state.projects.filter((project) => project.id !== id),
      observations: state.observations.filter((obs) => obs.projeto_id !== id),
      statusHistory: state.statusHistory.filter((h) => h.projeto_id !== id),
    }));
  },

  toggleUrgente: (id, urgentData) => {
    const willBeUrgent = !get().projects.find((p) => p.id === id)?.urgente;
    set((state) => ({
      projects: state.projects.map((project) =>
        project.id === id ? {
          ...project,
          urgente: willBeUrgent,
          urgentDeadline: willBeUrgent ? (urgentData?.deadline ?? null) : null,
          urgentReason: willBeUrgent ? (urgentData?.reason?.trim() || null) : null,
          updated_at: nowDate(),
        } : project,
      ),
    }));
    if (isPending(id)) {
      debugLog("urgência adiada: projeto ainda não persistido", id);
      return;
    }
    void apiSetUrgency(id, willBeUrgent, urgentData?.reason, urgentData?.deadline)
      .then((real) => set((state) => ({ projects: state.projects.map((p) => (p.id === id ? real : p)) })))
      .catch(onPersistFailure("urgência", "Não foi possível atualizar a urgência do projeto."));
  },

  moveStatus: (id, nextStatus, origem, nota, finalCode) => {
    const current = get().projects.find((project) => project.id === id);
    if (!current) return { ok: false, error: "Projeto nao encontrado." };

    const validation = validateStatusTransition(current, nextStatus);
    if (!validation.allowed) {
      return { ok: false, error: validation.reason ?? "Transicao de status nao permitida." };
    }

    // Código final (ao entrar em Projeto Aprovado, status terminal): atualiza otimisticamente.
    const codeToApply = finalCode?.trim() ? finalCode.trim() : current.codigo_projeto;

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
              codigo_projeto: codeToApply,
              status_atual: nextStatus,
              status_entered_at: now,
              data_envio,
              data_aprovacao,
              reviewCount,
              reviewHistory: updatedReviewHistory,
              finalReviewCount,
              finalReviewHistory: updatedFinalReviewHistory,
              updated_at: now,
              ...(nextStatus === "PROJETO APROVADO" ? { urgente: false } : {}),
              // Enviar ante-projeto remove a urgência (espelha o backend). Limpa
              // flag, prazo e motivo para o card perder o badge imediatamente.
              ...(nextStatus === "ANTE-PROJETO ENVIADO"
                ? { urgente: false, urgentDeadline: null, urgentReason: null }
                : {}),
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

    if (isPending(id)) {
      // Projeto ainda não persistido — não dispara mudança de status com id antigo.
      debugLog("mudança de status adiada: projeto ainda não persistido", id);
      return { ok: true };
    }
    void apiChangeStatus(id, nextStatus, { source: origem, reason: nota, note: nota, finalCode: finalCode?.trim() || undefined })
      .then((real) => set((state) => ({ projects: state.projects.map((p) => (p.id === id ? real : p)) })))
      .catch(onPersistFailure("mudança de status", "Não foi possível alterar o status do projeto."));

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
    // Observação é secundária/não-crítica. Se o projeto ainda não foi persistido
    // (id temporário), a chamada cairia em 404 — então fica só local/debug.
    if (isPending(projetoId)) {
      debugLog("observação não persistida: projeto ainda não criado no banco", projetoId);
      return;
    }
    void apiAddObservation(projetoId, message).catch((e) => debugLog("falha ao persistir observação", e));
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
      debugLog("falha ao listar projetos", e);
    }
  },

  // ─── Lembretes operacionais ─────────────────────────────────────────────────
  // Ações de status (adiar/resolver/remover) são otimistas com rollback via
  // reload; criação/edição aguardam o backend (id/validação server-side).

  loadReminders: async () => {
    try {
      const reminders = await apiListReminders();
      set({ reminders });
    } catch (e) {
      debugLog("falha ao listar lembretes", e);
    }
  },

  createReminder: async (projectId, input) => {
    if (isPending(projectId)) {
      return { ok: false, error: "Aguarde o projeto terminar de salvar antes de criar lembretes." };
    }
    try {
      const reminder = await apiCreateReminder(projectId, input);
      set((state) => ({ reminders: [...state.reminders, reminder] }));
      return { ok: true };
    } catch (e) {
      const msg = messageFrom(e, "Não foi possível salvar o lembrete.");
      reportUserError(msg);
      return { ok: false, error: msg };
    }
  },

  updateReminder: async (id, patch) => {
    try {
      const reminder = await apiUpdateReminder(id, patch);
      set((state) => ({ reminders: state.reminders.map((r) => (r.id === id ? reminder : r)) }));
      return { ok: true };
    } catch (e) {
      const msg = messageFrom(e, "Não foi possível salvar as alterações do lembrete.");
      reportUserError(msg);
      return { ok: false, error: msg };
    }
  },

  postponeReminder: (id, date) => {
    set((state) => ({
      reminders: state.reminders.map((r) => (r.id === id ? { ...r, proxima_data: date } : r)),
    }));
    void apiPostponeReminder(id, date)
      .then((real) => set((state) => ({ reminders: state.reminders.map((r) => (r.id === id ? real : r)) })))
      .catch((e) => {
        debugLog("falha ao adiar lembrete", e);
        reportUserError(messageFrom(e, "Não foi possível adiar o lembrete."));
        void get().loadReminders();
      });
  },

  resolveReminder: (id) => {
    set((state) => ({
      reminders: state.reminders.map((r) => (r.id === id ? { ...r, status: "RESOLVIDO" as const } : r)),
    }));
    void apiResolveReminder(id)
      .then((real) => set((state) => ({ reminders: state.reminders.map((r) => (r.id === id ? real : r)) })))
      .catch((e) => {
        debugLog("falha ao resolver lembrete", e);
        reportUserError(messageFrom(e, "Não foi possível marcar o lembrete como resolvido."));
        void get().loadReminders();
      });
  },

  removeReminder: (id) => {
    set((state) => ({
      reminders: state.reminders.map((r) => (r.id === id ? { ...r, status: "CANCELADO" as const } : r)),
    }));
    void apiRemoveReminder(id)
      .then((real) => set((state) => ({ reminders: state.reminders.map((r) => (r.id === id ? real : r)) })))
      .catch((e) => {
        debugLog("falha ao remover lembrete", e);
        reportUserError(messageFrom(e, "Não foi possível remover o lembrete."));
        void get().loadReminders();
      });
  },

  // Busca o histórico/observações persistidos no MySQL e SUBSTITUI as entradas
  // deste projeto no store (mantém as dos demais). Resolve o caso de projetos
  // antigos cujo histórico/observações nunca foram carregados na sessão.
  loadProjectDetail: async (id) => {
    try {
      const detail = await apiGetHistory(id);
      set((state) => ({
        statusHistory: [
          ...detail.statusHistory,
          ...state.statusHistory.filter((h) => h.projeto_id !== id),
        ],
        observations: [
          ...detail.observations,
          ...state.observations.filter((o) => o.projeto_id !== id),
        ],
      }));
    } catch (e) {
      debugLog("falha ao carregar detalhe do projeto", e);
    }
  },

  // Carrega os dados agregados do MySQL (histórico de status completo + revisões)
  // usados pela aba KPIs: tempo médio por status, SLA, gargalos e SLAs de revisão.
  loadAnalytics: async () => {
    try {
      const { statusHistory, reviewStudy, finalReview } = await apiGetAnalytics();
      set({ statusHistory, reviewStudyAgg: reviewStudy, finalReviewAgg: finalReview });
    } catch (e) {
      debugLog("falha ao carregar dados agregados dos KPIs", e);
    }
  },
}));
