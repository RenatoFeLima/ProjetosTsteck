// Tipos do relatório de ENRIQUECIMENTO de projetos finais/aprovados via CSV.
// Diferente das outras importações: NÃO cria nem deleta projetos — apenas
// atualiza projetos já existentes nos status PROJETO_FINAL_ENVIADO e
// PROJETO_APROVADO, casando por CONSTRUTORA + OBRA (não por código).

/** Um campo que será alterado: valor atual no sistema → valor vindo da planilha. */
export type FieldChange = {
  field: "codigo" | "vendedor" | "equipamento" | "tipo_cabine" | "engenheiro" | "telefone";
  label: string;
  from: string | null;
  to: string | null;
};

/** Projeto encontrado por construtora+obra que será atualizado (match único e seguro). */
export type FinalProjectMatch = {
  projectId: string;
  construtora: string;
  obra: string;
  statusLabel: string;
  /** Linha do CSV (1-based, sem contar cabeçalho) — ajuda na revisão. */
  csvRow: number;
  changes: FieldChange[];
  /** Pendências de cadastro mestre não encontrado (campo é pulado, demais aplicados). */
  pendingRefs: { field: "vendedor" | "equipamento" | "tipo_cabine"; valor: string }[];
  /** Observação que será adicionada (se houver e não duplicar). */
  observationToAdd: string | null;
};

/** Linha do CSV que NÃO gera atualização (com o motivo). */
export type FinalProjectSkipped = {
  csvRow: number;
  construtora: string;
  obra: string;
  /** Categoria do bloqueio para o resumo. */
  reason:
    | "nao-encontrado"
    | "conflito-multiplos"
    | "fora-do-escopo"
    | "codigo-duplicado"
    | "linha-invalida";
  detail: string;
};

export type FinalProjectsDiagnostic = {
  delimiter: string;
  delimiterLabel: string;
  columns: string[];
  firstRow: Record<string, string> | null;
};

export type FinalProjectsReport = {
  dryRun: boolean;
  diagnostic: FinalProjectsDiagnostic;

  rowsRead: number;
  /** Projetos no escopo (FINAL_ENVIADO/APROVADO) existentes no banco no momento da análise. */
  projectsInScope: number;

  /** Linhas que casaram em exatamente 1 projeto no escopo e serão atualizadas. */
  matched: FinalProjectMatch[];

  /** Resumo por categoria de bloqueio. */
  notFound: FinalProjectSkipped[];
  conflicts: FinalProjectSkipped[];
  outOfScope: FinalProjectSkipped[];
  duplicateCodes: FinalProjectSkipped[];
  invalidRows: FinalProjectSkipped[];

  /** Cadastros mestres não encontrados (agregado, para revisão). */
  sellersNotFound: string[];
  equipmentNotFound: string[];
  cabinTypesNotFound: string[];

  /** Resultado do commit. */
  committed?: {
    projectsUpdated: number;
    codesUpdated: number;
    observationsAdded: number;
    backupFile: string;
    projectsBefore: number;
  };

  /** Backup gerado antes do commit (snapshot das tabelas afetadas). */
  backup?: FinalProjectsBackup;
};

/** Snapshot persistido na resposta + audit para rollback manual. */
export type FinalProjectsBackup = {
  fileName: string;
  createdAt: string;
  createdBy: string;
  projectsBefore: number;
  /** Estado anterior dos projetos que serão tocados (apenas os afetados). */
  projects: Array<Record<string, unknown>>;
};

// ─── Commit em lotes (chunked) ─────────────────────────────────────────────────

/** Erro de um item dentro de um lote (não interrompe o lote inteiro). */
export type FinalProjectsBatchError = {
  projectId: string;
  detail: string;
};

/**
 * Resposta de UM lote do commit. O cliente reenvia o CSV + offset a cada lote.
 * O backup só vem no primeiro lote (offset 0), antes de qualquer escrita.
 */
export type FinalProjectsBatchResult = {
  /** Total de updates seguros no plano (igual em todos os lotes — determinístico). */
  total: number;
  /** Offset solicitado (início deste lote). */
  offset: number;
  /** Quantos itens foram processados neste lote. */
  processed: number;
  /** Próximo offset, ou null se acabou. */
  nextOffset: number | null;
  /** Acumuladores deste lote. */
  projectsUpdated: number;
  codesUpdated: number;
  observationsAdded: number;
  errors: FinalProjectsBatchError[];
  /** Backup — presente SOMENTE no primeiro lote (offset 0). */
  backup?: FinalProjectsBackup;
  /** true quando este foi o último lote. */
  done: boolean;
};
