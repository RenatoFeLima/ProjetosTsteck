import { addDays, differenceInCalendarDays, formatISO, parseISO, isWeekend } from "date-fns";

/**
 * Conta dias úteis (seg–sex, sem feriados) entre `from` e `to`.
 * Valor positivo = `to` está no futuro; negativo = `to` está no passado.
 * Ambas as datas são normalizadas para meia-noite antes da contagem.
 */
export function countBusinessDays(from: Date, to: Date): number {
  const a = new Date(from); a.setHours(0, 0, 0, 0);
  const b = new Date(to);   b.setHours(0, 0, 0, 0);
  if (a.getTime() === b.getTime()) return 0;
  const forward = b > a;
  let cursor = new Date(a);
  let count = 0;
  while (cursor.getTime() !== b.getTime()) {
    cursor = addDays(cursor, forward ? 1 : -1);
    if (!isWeekend(cursor)) count++;
  }
  return forward ? count : -count;
}
import type {
  AlignmentAutomationResult,
  PrazoBadge,
  Project,
  ReviewHistoryItem,
  StatusHistoryItem,
  ProjectStatus,
} from "./project-types";

export type SlaState = "ok" | "atencao" | "estourado";

export type ProjectOperationalKpis = {
  diasDesdeCadastro: number;
  diasSemAtualizacao: number;
  diasNoStatusAtual: number;
  slaTargetDias: number;
  slaRestanteDias: number;
  slaState: SlaState;
};

// SLA operacional interno por status (monitoramento de pipeline)
const STATUS_SLA_TARGET_DAYS: Record<ProjectStatus, number> = {
  "CADASTRO INICIAL": 3,
  "ELABORAR ANTE-PROJETO": 10,
  "ANTE-PROJETO ENVIADO": 7,
  "ANTE-PROJETO APROVADO": 7,
  "PROJETO APROVADO": 7,
  "PROJETO FINAL ENVIADO": 5,
  "REVISAO DE ESTUDO": 4,
  "REVISAO DE PROJETO FINAL": 4,
};

// Prazo externo por status (compromisso com o cliente/fluxo)
const STATUS_DEADLINE_DAYS: Partial<Record<ProjectStatus, number>> = {
  "ELABORAR ANTE-PROJETO": 45,
  "REVISAO DE ESTUDO": 20,
  "REVISAO DE PROJETO FINAL": 20,
};

// ─── Transições permitidas no fluxo ───────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  "CADASTRO INICIAL": ["ELABORAR ANTE-PROJETO"],
  "ELABORAR ANTE-PROJETO": ["ANTE-PROJETO ENVIADO"],
  "ANTE-PROJETO ENVIADO": ["ANTE-PROJETO APROVADO", "REVISAO DE ESTUDO"],
  "REVISAO DE ESTUDO": ["ANTE-PROJETO ENVIADO"],
  // Fluxo final invertido: Projeto Final Enviado vem ANTES; Projeto Aprovado é o
  // último status oficial (terminal).
  "ANTE-PROJETO APROVADO": ["PROJETO FINAL ENVIADO"],
  "PROJETO FINAL ENVIADO": ["PROJETO APROVADO", "REVISAO DE PROJETO FINAL"],
  "REVISAO DE PROJETO FINAL": ["PROJETO FINAL ENVIADO"],
  "PROJETO APROVADO": [],
};

export type StatusTransitionValidation = {
  allowed: boolean;
  reason?: string;
  missingFields?: string[];
};

/**
 * Valida se a transição de status é permitida pelas regras de negócio.
 * Retorna allowed=true se permitida, ou allowed=false com reason e missingFields.
 */
export function validateStatusTransition(
  project: Project,
  toStatus: ProjectStatus,
): StatusTransitionValidation {
  const from = project.status_atual;
  if (from === toStatus) return { allowed: true };

  const allowed = ALLOWED_TRANSITIONS[from]?.includes(toStatus) ?? false;
  if (!allowed) {
    return {
      allowed: false,
      reason: `Movimentação de "${from}" para "${toStatus}" não é permitida no fluxo.`,
    };
  }

  if (from === "CADASTRO INICIAL" && toStatus === "ELABORAR ANTE-PROJETO") {
    const missingFields: string[] = [];
    if (!project.proj_obra_recebido) missingFields.push("Projeto de obra recebido");
    if (!project.local_cabine_definido) missingFields.push("Local da cabine definido");
    if (!project.alinhamento) missingFields.push("Alinhamento concluído");
    if (missingFields.length > 0) {
      return {
        allowed: false,
        reason: "Alinhamento não concluído.",
        missingFields,
      };
    }
  }

  return { allowed: true };
}

export type CurrentStatusDeadline = {
  hasDeadline: boolean;
  deadlineDays?: number;
  enteredAt?: string;
  dueDate?: string;
  daysElapsed?: number;
  daysRemaining?: number;
  isOverdue: boolean;
  overdueDays?: number;
  label: string;
};

/**
 * Calcula o prazo da etapa atual do projeto.
 * - ELABORAR ANTE-PROJETO: 45 dias a partir de status_entered_at
 * - REVISAO DE ESTUDO: 20 dias a partir de status_entered_at
 * - Demais status: sem prazo ativo
 */
export function getCurrentStatusDeadline(project: Project, todayOverride?: string): CurrentStatusDeadline {
  const today = todayOverride ?? todayIsoDate();
  const todayDate = parseISO(today);

  // Prazo absoluto (vindo de importação CSV) tem prioridade sobre o cálculo por status.
  if (project.deadline) {
    const dueDateStr = project.deadline.slice(0, 10);
    const dueDate = parseISO(dueDateStr);
    const diff = differenceInCalendarDays(dueDate, todayDate);
    const isOverdue = diff < 0;
    return {
      hasDeadline: true,
      dueDate: dueDateStr,
      daysRemaining: isOverdue ? 0 : diff,
      isOverdue,
      overdueDays: isOverdue ? Math.abs(diff) : 0,
      label: isOverdue ? `${Math.abs(diff)}d atraso` : diff === 0 ? "Vence hoje" : `${diff}d restantes`,
    };
  }

  const { status_atual, status_entered_at } = project;
  const deadlineDays = STATUS_DEADLINE_DAYS[status_atual];

  if (!deadlineDays || !status_entered_at) {
    return { hasDeadline: false, isOverdue: false, label: "Sem prazo" };
  }

  const enteredAt = parseISO(status_entered_at);
  const dueDate = addDays(enteredAt, deadlineDays);
  const daysRemaining = differenceInCalendarDays(dueDate, todayDate);
  const isOverdue = daysRemaining < 0;
  const daysElapsed = Math.max(differenceInCalendarDays(todayDate, enteredAt), 0);

  return {
    hasDeadline: true,
    deadlineDays,
    enteredAt: status_entered_at,
    dueDate: formatISO(dueDate, { representation: "date" }),
    daysElapsed,
    daysRemaining: isOverdue ? 0 : daysRemaining,
    isOverdue,
    overdueDays: isOverdue ? Math.abs(daysRemaining) : 0,
    label: isOverdue ? `${Math.abs(daysRemaining)}d atraso` : daysRemaining === 0 ? "Vence hoje" : `${daysRemaining}d restantes`,
  };
}

// Status com SLA operacional ativo: são os únicos onde o prazo normal de
// execução faz sentido exibir no card/tabela/Kanban.
const OPERATIONAL_DEADLINE_STATUSES: ProjectStatus[] = [
  "ELABORAR ANTE-PROJETO",
  "REVISAO DE ESTUDO",
  "REVISAO DE PROJETO FINAL",
];

/**
 * Decide se o prazo operacional normal deve aparecer no card/tabela/Kanban.
 *
 * Regra de prioridade visual:
 *  1. Projeto urgente nunca mostra prazo normal (a urgência tem prioridade e é
 *     exibida pelo UrgenteBadge com base em urgentDeadline) — evita mostrar os
 *     dois prazos ao mesmo tempo.
 *  2. Caso contrário, só mostra prazo nos status com SLA operacional ativo
 *     (ELABORAR ANTE-PROJETO = 45d; REVISAO DE ESTUDO / PROJETO FINAL = 20d).
 *  3. Demais status não exibem nenhum texto de prazo.
 */
export function shouldShowOperationalDeadline(project: Project): boolean {
  if (project.urgente) return false;
  return OPERATIONAL_DEADLINE_STATUSES.includes(project.status_atual);
}

/**
 * Retorna o sufixo ordenável do código do projeto (último bloco após hífen).
 * Se numérico, retorna como número. Caso contrário, retorna string em minúsculas.
 */
export function getCodeSortableSuffix(code: string): string | number {
  const trimmed = code.trim();
  const parts = trimmed.split("-");
  if (parts.length < 2) return trimmed.toLowerCase();
  const suffix = parts[parts.length - 1].trim().toLowerCase();
  const numericSuffix = Number(suffix);
  if (!isNaN(numericSuffix) && suffix !== "") return numericSuffix;
  return suffix;
}

export function todayIsoDate(): string {
  return formatISO(new Date(), { representation: "date" });
}

/**
 * Normaliza qualquer data (ISO completo, Date ou já yyyy-MM-dd) para o formato
 * exigido por <input type="date"> (yyyy-MM-dd). Nunca passe ISO completo para um
 * input date — gera o warning "does not conform to the required format".
 * Para strings já em yyyy-MM-dd (ou ISO), usa a porção de data literal, evitando
 * deslocamento de fuso horário.
 */
export function toDateInputValue(value?: string | Date | null): string {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function computePrazoEntrega(dataAlinhamento: string | null, prazoPrerequisitosOk = true): string | null {
  if (!prazoPrerequisitosOk || !dataAlinhamento) return null;
  return formatISO(addDays(parseISO(dataAlinhamento), 45), { representation: "date" });
}

export function computePrazoBadge(todayISO: string, prazoEntregaISO: string | null): PrazoBadge {
  if (!prazoEntregaISO) return "sem_prazo";
  const delta = differenceInCalendarDays(parseISO(prazoEntregaISO), parseISO(todayISO));
  if (delta < 0) return "atrasado";
  if (delta <= 15) return "atencao";
  return "no_prazo";
}

export function prazoLabel(todayISO: string, prazoEntregaISO: string | null): string {
  if (!prazoEntregaISO) return "Sem prazo ativo";
  const delta = differenceInCalendarDays(parseISO(prazoEntregaISO), parseISO(todayISO));
  if (delta < 0) return `${Math.abs(delta)} dias atrasados`;
  return `${delta} dias restantes`;
}

export function canAdvanceStatus(aligned: boolean): boolean {
  return aligned;
}

export function applyAlignmentAutomation(input: {
  proj_obra_recebido: boolean;
  local_cabine_definido: boolean;
  alinhamento: boolean;
  data_alinhamento: string | null;
}): AlignmentAutomationResult {
  const prereqOk = input.proj_obra_recebido && input.local_cabine_definido;
  if (!prereqOk) {
    return { alinhamentoSuggested: false, nextDataAlinhamento: input.data_alinhamento };
  }
  return {
    alinhamentoSuggested: true,
    nextDataAlinhamento: input.data_alinhamento ?? todayIsoDate(),
  };
}

export function transitionStatus(input: {
  currentStatus: ProjectStatus;
  nextStatus: ProjectStatus;
  aligned: boolean;
  today: string;
  data_envio: string | null;
  data_aprovacao: string | null;
}) {
  // Constrói um projeto mínimo para usar validateStatusTransition
  const mockProject = {
    status_atual: input.currentStatus,
    proj_obra_recebido: input.aligned,
    local_cabine_definido: input.aligned,
    alinhamento: input.aligned,
  } as Project;

  const validation = validateStatusTransition(mockProject, input.nextStatus);
  if (!validation.allowed) {
    throw new Error(validation.reason ?? "Transição de status não permitida.");
  }

  return {
    data_envio:
      input.nextStatus === "ANTE-PROJETO ENVIADO" && !input.data_envio
        ? input.today
        : input.data_envio,
    data_aprovacao:
      input.nextStatus === "ANTE-PROJETO APROVADO" && !input.data_aprovacao
        ? input.today
        : input.data_aprovacao,
  };
}

/**
 * Modos de ordenação do Kanban (apenas dos NÃO-urgentes; urgentes ficam sempre
 * no topo independentemente do modo):
 *  - "deadline": pela data de vencimento do prazo normal do status (padrão).
 *  - "oldest":   pela data base do projeto (data_lancamento/created_at), mais antigo primeiro.
 *  - "newest":   inverso de "oldest", mais novo primeiro.
 */
export type KanbanSortMode = "deadline" | "oldest" | "newest";

export const DEFAULT_KANBAN_SORT_MODE: KanbanSortMode = "deadline";

/** Data base do projeto p/ ordenação por antiguidade: data de lançamento/cadastro
 *  (que o sistema deriva de createdAt), com fallback para created_at. yyyy-MM-dd. */
function baseDateKey(project: Project): string | null {
  return deadlineKey(project.data_lancamento) ?? deadlineKey(project.created_at);
}

/**
 * Ordena projetos para exibição no Kanban. Em TODOS os modos:
 *   1. Urgentes sempre no topo.
 *   2. Entre urgentes: por urgentDeadline crescente (vencidos primeiro; sem
 *      deadline por último).
 *   3. Depois, os não-urgentes — ordenados conforme `mode`:
 *      - "deadline": pela data de vencimento do prazo normal (vencidos antes;
 *        sem prazo calculável no final).
 *      - "oldest": pela data base (mais antigo primeiro; sem data no final).
 *      - "newest": pela data base (mais novo primeiro; sem data no final).
 *
 * Comparar strings yyyy-MM-dd equivale a comparar as datas. Sort estável do JS
 * preserva a ordem original em empates (ex.: dois projetos sem prazo/data).
 */
export function sortProjectsForKanban(
  projects: Project[],
  mode: KanbanSortMode = DEFAULT_KANBAN_SORT_MODE,
): Project[] {
  return [...projects].sort((a, b) => {
    const aUrgent = a.urgente;
    const bUrgent = b.urgente;

    // 1. Urgentes no topo.
    if (aUrgent !== bUrgent) return aUrgent ? -1 : 1;

    // 2. Entre urgentes: por urgentDeadline (data absoluta) crescente (todos os modos).
    if (aUrgent && bUrgent) {
      return compareDueDates(deadlineKey(a.urgentDeadline), deadlineKey(b.urgentDeadline));
    }

    // 3. Entre não-urgentes: conforme o modo selecionado.
    if (mode === "oldest" || mode === "newest") {
      const cmp = compareDueDates(baseDateKey(a), baseDateKey(b)); // crescente = mais antigo primeiro; null por último
      // "newest" inverte apenas a ORDEM por data; null permanece no final (não invertido).
      if (mode === "newest" && cmp !== 0 && baseDateKey(a) !== null && baseDateKey(b) !== null) {
        return -cmp;
      }
      return cmp;
    }

    // "deadline" (padrão): pela data de vencimento do prazo normal do status.
    return compareDueDates(
      deadlineKey(getCurrentStatusDeadline(a).dueDate),
      deadlineKey(getCurrentStatusDeadline(b).dueDate),
    );
  });
}

/** Normaliza um deadline para chave comparável (yyyy-MM-dd) ou null se ausente. */
function deadlineKey(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

/** Compara duas datas de vencimento: menor (mais próxima/vencida) primeiro;
 *  null (sem prazo calculável) sempre por último. Empate → 0 (ordem estável). */
function compareDueDates(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b);
}

export function statusOrder(status: ProjectStatus): number {
  const order: Record<ProjectStatus, number> = {
    "CADASTRO INICIAL": 0,
    "ELABORAR ANTE-PROJETO": 1,
    "ANTE-PROJETO ENVIADO": 2,
    "ANTE-PROJETO APROVADO": 3,
    "PROJETO FINAL ENVIADO": 4,
    "PROJETO APROVADO": 5,
    "REVISAO DE ESTUDO": 6,
    "REVISAO DE PROJETO FINAL": 7,
  };
  return order[status];
}

export function validateRequiredFields(input: Partial<Project>): string[] {
  const required: Array<keyof Project> = [
    "construtora",
    "obra",
    "codigo_projeto",
    "vendedor",
    "equipamento",
    "data_lancamento",
  ];
  return required.filter((k) => !String(input[k] ?? "").trim());
}

export function computeNextAction(project: Project): string {
  if (!project.proj_obra_recebido) return "Aguardando projeto do cliente";
  if (!project.local_cabine_definido) return "Aguardando localizacao da cabine";

  if (project.status_atual === "CADASTRO INICIAL") {
    if (!project.alinhamento) return "Aguardando alinhamento";
    return "Liberar para elaborar anteprojeto";
  }

  if (project.status_atual === "ELABORAR ANTE-PROJETO") return "Elaborar anteprojeto";
  if (project.status_atual === "ANTE-PROJETO ENVIADO") return "Aguardando aprovacao do cliente";
  if (project.status_atual === "REVISAO DE ESTUDO") return "Revisar estudo e reenviar anteprojeto";
  if (project.status_atual === "ANTE-PROJETO APROVADO") return "Preparar e enviar o projeto final";
  if (project.status_atual === "PROJETO FINAL ENVIADO") return "Validar e aprovar o projeto final";
  if (project.status_atual === "PROJETO APROVADO") return "Projeto concluido";
  if (project.status_atual === "REVISAO DE PROJETO FINAL") return "Revisar projeto final e reenviar";
  return "Verificar pendencias";
}

export function computeOperationalKpis(
  project: Project,
  statusHistory: StatusHistoryItem[],
  todayISO = todayIsoDate(),
): ProjectOperationalKpis {
  const today = parseISO(todayISO);
  const cadastro = parseISO(project.data_lancamento);
  const updated = parseISO(project.updated_at);

  const latestCurrentStatusEntry = statusHistory
    .filter((item) => item.status_para === project.status_atual)
    .sort((a, b) => (a.alterado_em < b.alterado_em ? 1 : -1))[0];

  const enteredStatusAt = parseISO(latestCurrentStatusEntry?.alterado_em ?? project.created_at);

  const diasDesdeCadastro = Math.max(differenceInCalendarDays(today, cadastro), 0);
  const diasSemAtualizacao = Math.max(differenceInCalendarDays(today, updated), 0);
  const diasNoStatusAtual = Math.max(differenceInCalendarDays(today, enteredStatusAt), 0);

  const slaTargetDias = STATUS_SLA_TARGET_DAYS[project.status_atual];
  const slaRestanteDias = slaTargetDias - diasNoStatusAtual;

  let slaState: SlaState = "ok";
  if (slaRestanteDias < 0) slaState = "estourado";
  else if (slaRestanteDias <= 2) slaState = "atencao";

  return {
    diasDesdeCadastro,
    diasSemAtualizacao,
    diasNoStatusAtual,
    slaTargetDias,
    slaRestanteDias,
    slaState,
  };
}
