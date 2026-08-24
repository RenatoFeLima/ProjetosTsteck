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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Tempo decorrido em DIAS ÚTEIS (seg–sex) entre `from` e `to`, com fração.
 *
 * Diferente de countBusinessDays (que conta transições inteiras de dia), esta
 * soma apenas os milissegundos que caem em dias úteis e divide por 24h, então
 * preserva a fração de dia. Sábados e domingos são ignorados por completo
 * (sexta 18h → segunda 6h conta só a parte útil, sem o fim de semana).
 * Feriados NÃO são considerados nesta etapa. Retorna 0 se `to` <= `from`.
 */
export function businessDaysBetween(from: Date, to: Date): number {
  if (to.getTime() <= from.getTime()) return 0;

  let usefulMs = 0;
  let cursor = new Date(from);

  while (cursor.getTime() < to.getTime()) {
    // Fim do dia corrente (meia-noite seguinte).
    const dayEnd = new Date(cursor);
    dayEnd.setHours(24, 0, 0, 0);
    const segmentEnd = dayEnd.getTime() < to.getTime() ? dayEnd : to;

    if (!isWeekend(cursor)) {
      usefulMs += segmentEnd.getTime() - cursor.getTime();
    }
    cursor = segmentEnd;
  }

  return usefulMs / MS_PER_DAY;
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
  // SLA só existe em status com SLA de desenvolvimento; nos demais é null (sem
  // meta, sem estouro). hasSla facilita o gate na UI.
  hasSla: boolean;
  slaTargetDias: number | null;
  slaRestanteDias: number | null;
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

// ─── SLA de DESENVOLVIMENTO (única fonte de "atraso operacional") ──────────────
//
// Somente estes status possuem prazo de desenvolvimento, SLA estourado e
// contagem de atraso. TODOS os demais status (CADASTRO INICIAL, ANTE-PROJETO
// ENVIADO/APROVADO, PROJETO FINAL ENVIADO, PROJETO APROVADO) NÃO são atrasados
// por SLA operacional — nem no drawer, nem no KPI "Atrasados", nem nos alertas.
export const DEVELOPMENT_SLA_STATUSES: ProjectStatus[] = [
  "ELABORAR ANTE-PROJETO",
  "REVISAO DE ESTUDO",
  "REVISAO DE PROJETO FINAL",
];

/** True somente para os status que têm prazo/SLA de desenvolvimento. */
export function hasDevelopmentSla(status: ProjectStatus): boolean {
  return DEVELOPMENT_SLA_STATUSES.includes(status);
}

// ─── Status OPERACIONAIS / ACTIONÁVEIS (base dos KPIs de fluxo e risco) ────────
//
// PROJETO APROVADO é o status TERMINAL da carteira: não é etapa operacional em
// andamento nem risco. Ele só aparece em "Projetos aprovados" (Produção do
// Período, por entrada no status) e "Aprovados atualmente" (Carteira Atual, por
// status atual). NUNCA deve entrar em: gargalos/permanência média, maior
// concentração, projetos sem movimentação, projetos que exigem atenção, risco,
// sem prazo, atrasados por SLA, ou ações recomendadas operacionais.
//
// Esta é a única lista de status "em andamento operacional" — use isOperationalStatus.
export const OPERATIONAL_ACTIVE_STATUSES: ProjectStatus[] = [
  "CADASTRO INICIAL",
  "ELABORAR ANTE-PROJETO",
  "ANTE-PROJETO ENVIADO",
  "ANTE-PROJETO APROVADO",
  "PROJETO FINAL ENVIADO",
  "REVISAO DE ESTUDO",
  "REVISAO DE PROJETO FINAL",
];

/** True para status operacionais/actionáveis (exclui o terminal PROJETO APROVADO). */
export function isOperationalStatus(status: ProjectStatus): boolean {
  return OPERATIONAL_ACTIVE_STATUSES.includes(status);
}

// Prazo externo por status (compromisso com o cliente/fluxo).
// Derivado de DEVELOPMENT_SLA_STATUSES: exatamente os mesmos status têm prazo.
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

  // Atraso/SLA só existe em status com SLA de desenvolvimento. Demais status
  // (inclusive PROJETO FINAL ENVIADO / PROJETO APROVADO) nunca são atrasados por
  // prazo operacional, mesmo com deadline absoluto importado.
  if (!hasDevelopmentSla(project.status_atual)) {
    return { hasDeadline: false, isOverdue: false, label: "Sem prazo" };
  }

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
 * Modos de ordenação do Kanban. TODOS ordenam os NÃO-urgentes pela DATA DE
 * VENCIMENTO exibida no card — getCurrentStatusDeadline(project).dueDate —, nunca
 * pela data de cadastro/lançamento. Urgentes ficam sempre no topo (por urgentDeadline).
 *  - "deadline": vencimento crescente (mais próximo/vencido primeiro). Padrão.
 *  - "oldest":   vencimento crescente — data mais antiga primeiro (= "deadline").
 *  - "newest":   vencimento decrescente — data mais nova primeiro.
 * Em todos, projetos sem dueDate calculável ficam no final.
 */
export type KanbanSortMode = "deadline" | "oldest" | "newest";

export const DEFAULT_KANBAN_SORT_MODE: KanbanSortMode = "deadline";

/**
 * Ordena projetos para exibição no Kanban. Em TODOS os modos:
 *   1. Urgentes sempre no topo.
 *   2. Entre urgentes: por urgentDeadline crescente (vencidos primeiro; sem
 *      deadline por último).
 *   3. Depois, os não-urgentes, ordenados pela DATA DO PRAZO DO CARD
 *      (getCurrentStatusDeadline.dueDate) conforme `mode`:
 *      - "deadline"/"oldest": crescente (mais antiga primeiro);
 *      - "newest": decrescente (mais nova primeiro);
 *      - sem dueDate calculável sempre no final (em todos os modos).
 *
 * Comparar strings yyyy-MM-dd equivale a comparar as datas. Sort estável do JS
 * preserva a ordem original em empates (ex.: dois projetos sem prazo).
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

    // 3. Entre não-urgentes: sempre pela data do prazo do card (dueDate).
    const aDue = deadlineKey(getCurrentStatusDeadline(a).dueDate);
    const bDue = deadlineKey(getCurrentStatusDeadline(b).dueDate);
    const cmp = compareDueDates(aDue, bDue); // crescente; null (sem prazo) por último

    // "newest" inverte apenas a ORDEM entre datas válidas; sem dueDate permanece
    // no final (não invertido).
    if (mode === "newest" && cmp !== 0 && aDue !== null && bDue !== null) {
      return -cmp;
    }
    return cmp;
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

// ─── Ordenação por sufixo numérico do código (colunas de projeto final) ───────

/**
 * Colunas terminais onde os cards são ordenados pelos 4 últimos dígitos do
 * código do projeto, em ordem DECRESCENTE (2060 antes de 2059...). As demais
 * colunas mantêm a ordenação por prazo/urgência (sortProjectsForKanban).
 */
export const CODE_DESC_SORTED_COLUMNS: ProjectStatus[] = [
  "PROJETO FINAL ENVIADO",
  "PROJETO APROVADO",
];

/**
 * Extrai o sufixo numérico do código do projeto — preferencialmente os últimos
 * 4 dígitos no FINAL do código (regex `(\d{4})$`).
 *  - "CRE-UBA-2060" → 2060
 *  - código vazio/nulo, ou que não termina em 4 dígitos → null (vai para o fim).
 * Não modifica o código; apenas lê.
 */
export function getCodeNumericSuffix(code: string | null | undefined): number | null {
  if (!code) return null;
  const match = code.trim().match(/(\d{4})$/);
  if (!match) return null;
  return Number(match[1]);
}

/**
 * Ordena projetos pelo sufixo numérico do código em ordem DECRESCENTE.
 * Fallback:
 *  - código sem 4 dígitos finais / vazio / nulo → sempre no final;
 *  - empate (mesmo sufixo, ou ambos inválidos) → preserva a ordem de entrada
 *    (sort estável do JS), que já vem ordenada por prazo/urgência.
 * Não altera nenhum campo do projeto.
 */
export function sortProjectsByCodeDesc(projects: Project[]): Project[] {
  return [...projects].sort((a, b) => {
    const aKey = getCodeNumericSuffix(a.codigo_projeto);
    const bKey = getCodeNumericSuffix(b.codigo_projeto);
    if (aKey === bKey) return 0; // empate ou ambos null → ordem estável (fallback)
    if (aKey === null) return 1; // inválido por último
    if (bKey === null) return -1;
    return bKey - aKey; // decrescente
  });
}

// ─── Ordenação por DATA DE ENTRADA no status atual ───────────────────────────

/**
 * Colunas ordenadas pela DATA/HORA EM QUE O PROJETO ENTROU no status atual —
 * e não por vencimento (que ali não existe: ANTE-PROJETO APROVADO não tem SLA,
 * logo getCurrentStatusDeadline não produz dueDate e a ordenação por prazo
 * seria um no-op).
 */
export const STATUS_ENTRY_SORTED_COLUMNS: ProjectStatus[] = ["ANTE-PROJETO APROVADO"];

/**
 * Modos de ordenação por data de entrada no status atual.
 *  - "entryNewest": entrou mais recentemente primeiro. Padrão.
 *  - "entryOldest": está há mais tempo no status primeiro (aguardando avanço).
 */
export type StatusEntrySortMode = "entryNewest" | "entryOldest";

export const DEFAULT_STATUS_ENTRY_SORT_MODE: StatusEntrySortMode = "entryNewest";

/** União dos modos aceitos pelo controle de ordenação das colunas do Kanban. */
export type ColumnSortMode = KanbanSortMode | StatusEntrySortMode;

/**
 * Chave de ordenação = instante da entrada no status ATUAL (project.status_entered_at,
 * espelho de Project.currentStatusEnteredAt, gravado na MESMA transação e com o
 * MESMO timestamp do registro em ProjectStatusHistory).
 *
 * Para um projeto que ESTÁ no status, esse valor é por construção a entrada MAIS
 * RECENTE nele — reentradas sobrescrevem o campo, então um projeto que saiu e
 * voltou usa a data do retorno.
 *
 * Ausente/inválida → null (NUNCA inventa data e nunca cai para createdAt/updatedAt).
 */
function statusEntryKey(project: Project): number | null {
  const raw = project.status_entered_at;
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Ordena projetos de uma coluna pela data de entrada no status atual.
 * Fallback determinístico (mesmo padrão já usado nas demais colunas):
 *  - sem data de entrada válida → SEMPRE no final, nos dois modos;
 *  - empate (mesmo instante, ou ambos sem data) → preserva a ordem de entrada
 *    (sort estável do JS).
 * Não considera urgência, prazo, código, createdAt nem updatedAt.
 */
export function sortProjectsByStatusEntry(
  projects: Project[],
  mode: StatusEntrySortMode = DEFAULT_STATUS_ENTRY_SORT_MODE,
): Project[] {
  return [...projects].sort((a, b) => {
    const aKey = statusEntryKey(a);
    const bKey = statusEntryKey(b);
    if (aKey === null && bKey === null) return 0; // ambos sem data → ordem estável
    if (aKey === null) return 1; // sem data por último
    if (bKey === null) return -1;
    if (aKey === bKey) return 0; // empate → ordem estável
    // Crescente = mais antigo primeiro; "entryNewest" inverte.
    return mode === "entryNewest" ? bKey - aKey : aKey - bKey;
  });
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

  // SLA/atraso só se aplica a status com SLA de desenvolvimento. Nos demais,
  // não há meta nem estouro: slaTargetDias/slaRestanteDias = null, estado "ok".
  if (!hasDevelopmentSla(project.status_atual)) {
    return {
      diasDesdeCadastro,
      diasSemAtualizacao,
      diasNoStatusAtual,
      hasSla: false,
      slaTargetDias: null,
      slaRestanteDias: null,
      slaState: "ok",
    };
  }

  const slaTargetDias = STATUS_SLA_TARGET_DAYS[project.status_atual];
  const slaRestanteDias = slaTargetDias - diasNoStatusAtual;

  let slaState: SlaState = "ok";
  if (slaRestanteDias < 0) slaState = "estourado";
  else if (slaRestanteDias <= 2) slaState = "atencao";

  return {
    diasDesdeCadastro,
    diasSemAtualizacao,
    diasNoStatusAtual,
    hasSla: true,
    slaTargetDias,
    slaRestanteDias,
    slaState,
  };
}
