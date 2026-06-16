// Tipos do relatório de importação do Ante-Projeto CSV.
// Separado do ImportReport legacy porque o fluxo inclui deleção prévia de projetos.

export type AnteProjectRow = {
  construtora: string;
  obra: string;
  engenheiro: string;
  status: string;
  observacao: string;
  dataPrazo: string;
  equipamento: string;
  tipoCabine: string;
  projeto: string;
  vendedor: string;
};

export type AnteProjetoProjectToCreate = {
  code: string;
  tempCode: boolean;
  construtora: string;
  obra: string;
  status: string;
  statusLabel: string;
  urgente: boolean;
  deadline: string | null;
  // Referências resolvidas para exibição no dry-run
  equipamentoCsv: string;
  equipamentoVinculado: string | null;
  tipoCabineCsv: string;
  tipoCabineVinculado: string | null;
  vendedorCsv: string;
  vendedorVinculado: string | null;
};

export type AnteProjetoProjectToDelete = {
  id: string;
  code: string;
  construtora: string;
  obra: string;
  status: string;
  statusLabel: string;
};

export type AnteProjetoSkipped = {
  code: string;
  construtora: string;
  obra: string;
  reason: string;
};

/** Código duplicado no CSV mas com obra diferente — importado com código provisório. */
export type AnteProjetoCodeRemapped = {
  originalCode: string;
  newCode: string;
  construtora: string;
  obra: string;
  reason: string;
};

export type AnteProjetoRefNotFound = {
  construtora: string;
  obra: string;
  valor: string;
  field: "vendedor" | "equipamento" | "tipo_cabine";
};

export type AnteProjetoAliasResolved = {
  construtora: string;
  obra: string;
  field: "vendedor" | "equipamento" | "tipo_cabine";
  csvValue: string;
  resolvedTo: string;
};

export type AnteProjetoDiagnostic = {
  delimiter: string;
  delimiterLabel: string;
  columns: string[];
  firstRow: Record<string, string> | null;
  uniqueStatusValues: string[];
};

export type AnteProjetoReport = {
  dryRun: boolean;
  diagnostic: AnteProjetoDiagnostic;
  rowsRead: number;
  rowsValid: number;
  rowsInvalid: number;

  // Limpeza
  projectsToDelete: AnteProjetoProjectToDelete[];

  // Construtoras
  constructorsToCreate: { name: string }[];
  constructorsReused: number;

  // Obras
  worksToCreate: { construtora: string; obra: string }[];
  worksReused: number;
  worksDuplicateInFile: number;

  // Projetos
  projectsToCreate: AnteProjetoProjectToCreate[];
  projectsSkipped: AnteProjetoSkipped[];
  projectsUrgente: number;

  // Códigos provisórios gerados por duplicidade com obra diferente
  codeRemapped: AnteProjetoCodeRemapped[];

  // Prazo
  projectsWithDeadline: number;
  projectsWithoutDeadline: number;
  projectsOverdue: number;
  projectsDueToday: number;
  projectsFuture: number;
  dateErrors: { field: string; raw: string; construtora: string; obra: string }[];

  // Referências não encontradas
  sellersNotFound: AnteProjetoRefNotFound[];
  equipmentNotFound: AnteProjetoRefNotFound[];
  cabinTypesNotFound: AnteProjetoRefNotFound[];

  // Referências resolvidas por alias/normalização (informativo)
  resolvedAliases: AnteProjetoAliasResolved[];

  // Status breakdown
  byStatus: { ELABORAR_ANTE_PROJETO: number; ANTE_PROJETO_ENVIADO: number; ANTE_PROJETO_APROVADO: number };

  // Resultado do commit
  committed?: {
    deleted: number;
    constructors: number;
    works: number;
    projects: number;
  };
};
