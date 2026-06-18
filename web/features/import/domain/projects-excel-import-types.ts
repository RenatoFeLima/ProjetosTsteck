// Tipos do relatório de IMPORTAÇÃO Excel/CSV de projetos (reimportação do
// arquivo exportado pelo próprio sistema). Atualiza SOMENTE projetos existentes,
// casando por "ID do Projeto" (fallback: código único, depois construtora+obra).
// Não cria, não deleta, não altera status, não cria mestres.

/** Campo alterado: valor atual no sistema → valor vindo da planilha. */
export type ExcelFieldChange = {
  field:
    | "codigo"
    | "vendedor"
    | "equipamento"
    | "tipo_cabine"
    | "engenheiro"
    | "telefone"
    | "data_lancamento"
    | "proj_obra_recebido"
    | "local_cabine_definido"
    | "alinhamento"
    | "data_alinhamento"
    | "urgente"
    | "prazo_urgencia"
    | "motivo_urgencia";
  label: string;
  from: string | null;
  to: string | null;
};

export type ExcelMatchedProject = {
  projectId: string;
  /** Como o projeto foi localizado. */
  matchedBy: "id" | "codigo" | "construtora_obra";
  codigo: string;
  construtora: string;
  obra: string;
  csvRow: number;
  changes: ExcelFieldChange[];
  /** Pendências de cadastro mestre não encontrado (campo pulado). */
  pendingRefs: { field: "vendedor" | "equipamento" | "tipo_cabine"; valor: string }[];
  /** Aviso de divergência de status (informativo — status NÃO é alterado). */
  statusWarning?: { csv: string; atual: string };
  observationToAdd: string | null;
};

export type ExcelSkipped = {
  csvRow: number;
  codigo: string;
  construtora: string;
  obra: string;
  reason:
    | "nao-encontrado"
    | "conflito-multiplos"
    | "codigo-duplicado"
    | "urgencia-sem-prazo"
    | "data-invalida"
    | "linha-invalida";
  detail: string;
};

export type ExcelDiagnostic = {
  delimiter: string;
  delimiterLabel: string;
  columns: string[];
  hasIdColumn: boolean;
};

export type ProjectsExcelImportReport = {
  dryRun: boolean;
  diagnostic: ExcelDiagnostic;

  rowsRead: number;
  /** Linhas que casaram em 1 projeto e têm alteração a aplicar. */
  matched: ExcelMatchedProject[];

  notFound: ExcelSkipped[];
  conflicts: ExcelSkipped[];
  duplicateCodes: ExcelSkipped[];
  invalidRows: ExcelSkipped[];

  sellersNotFound: string[];
  equipmentNotFound: string[];
  cabinTypesNotFound: string[];

  /** Backup gerado no primeiro lote do commit. */
  backup?: ProjectsExcelBackup;

  committed?: {
    projectsUpdated: number;
    codesUpdated: number;
    observationsAdded: number;
    backupFile: string;
    projectsBefore: number;
  };
};

export type ProjectsExcelBackup = {
  fileName: string;
  createdAt: string;
  createdBy: string;
  projectsBefore: number;
  projects: Array<Record<string, unknown>>;
};

// ─── Commit em lotes ───────────────────────────────────────────────────────────

export type ExcelBatchError = { projectId: string; detail: string };

export type ProjectsExcelBatchResult = {
  total: number;
  offset: number;
  processed: number;
  nextOffset: number | null;
  projectsUpdated: number;
  codesUpdated: number;
  observationsAdded: number;
  errors: ExcelBatchError[];
  backup?: ProjectsExcelBackup;
  done: boolean;
};
