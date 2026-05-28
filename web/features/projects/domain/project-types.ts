export const PROJECT_STATUSES = [
  "CADASTRO INICIAL",
  "ELABORAR ANTE-PROJETO",
  "ANTE-PROJETO ENVIADO",
  "ANTE-PROJETO APROVADO",
  "PROJETO APROVADO",
  "PROJETO FINAL ENVIADO",
  "REVISAO DE ESTUDO",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type PrazoBadge = "sem_prazo" | "no_prazo" | "atencao" | "atrasado";

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
  data_previsao?: string | null;
  data_envio: string | null;
  data_aprovacao: string | null;
  data_prazo_ap?: string | null;
  variacao_cabine?: string;
  projeto_base?: string;
  aprovacao_final?: boolean;
  local_cabine_final?: boolean;
  data_final?: string | null;
  urgente: boolean;
  created_at: string;
  updated_at: string;
};

export type StatusHistoryItem = {
  id: string;
  projeto_id: string;
  status_de: ProjectStatus | null;
  status_para: ProjectStatus;
  alterado_em: string;
  origem: "kanban" | "formulario" | "acao-rapida";
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
