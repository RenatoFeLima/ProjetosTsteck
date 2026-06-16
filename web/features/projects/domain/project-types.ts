export const PROJECT_STATUSES = [
  "CADASTRO INICIAL",
  "ELABORAR ANTE-PROJETO",
  "ANTE-PROJETO ENVIADO",
  "ANTE-PROJETO APROVADO",
  "PROJETO FINAL ENVIADO",
  "PROJETO APROVADO",
  "REVISAO DE ESTUDO",
  "REVISAO DE PROJETO FINAL",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type PrazoBadge = "sem_prazo" | "no_prazo" | "atencao" | "atrasado";

export type ReviewHistoryItem = {
  id: string;
  enteredAt: string;
  exitedAt: string | null;
  reason: string;
  changedBy: string;
};

export type FinalReviewHistoryItem = {
  id: string;
  enteredAt: string;
  exitedAt: string | null;
  reason: string;
  changedBy: string;
};

export type Project = {
  id: string;
  construtora: string;
  obra: string;
  engenheiro_nome?: string;
  engenheiro_celular?: string;
  equipamento: string;
  tipo_cabine?: string;
  codigo_projeto: string;
  vendedor: string;
  proj_obra_recebido: boolean;
  local_cabine_definido: boolean;
  alinhamento: boolean;
  data_lancamento: string;
  data_alinhamento: string | null;
  status_atual: ProjectStatus;
  /** Data/hora em que o projeto entrou no status_atual. Usado para calcular prazos por etapa. */
  status_entered_at: string;
  data_previsao?: string | null;
  data_envio: string | null;
  data_aprovacao: string | null;
  data_prazo_ap?: string | null;
  /** Prazo absoluto definido via importação (formato ISO yyyy-MM-dd). Sobrepõe cálculo por status. */
  deadline?: string | null;
  variacao_cabine?: string;
  projeto_base?: string;
  aprovacao_final?: boolean;
  local_cabine_final?: boolean;
  data_final?: string | null;
  urgente: boolean;
  /** Quantidade total de vezes que o projeto entrou em Revisao de Estudo. */
  reviewCount: number;
  /** Historico detalhado de cada ciclo de Revisao de Estudo. */
  reviewHistory?: ReviewHistoryItem[];
  /** Quantidade total de vezes que o projeto entrou em Revisao de Projeto Final. */
  finalReviewCount: number;
  /** Historico detalhado de cada ciclo de Revisao de Projeto Final. */
  finalReviewHistory?: FinalReviewHistoryItem[];
  created_at: string;
  updated_at: string;
};

export type StatusHistoryItem = {
  id: string;
  projeto_id: string;
  status_de: ProjectStatus | null;
  status_para: ProjectStatus;
  alterado_em: string;
  origem: "kanban" | "formulario" | "acao-rapida" | "sistema";
  nota?: string;
};

export type ProjectObservation = {
  id: string;
  projeto_id: string;
  usuario: string;
  texto: string;
  criado_em: string;
};

export type AlignmentAutomationResult = {
  alinhamentoSuggested: boolean;
  nextDataAlinhamento: string | null;
};
