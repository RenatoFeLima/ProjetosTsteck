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

export type AnteProjetoRefNotFound = {
  construtora: string;
  obra: string;
  valor: string;
  field: "vendedor" | "equipamento" | "tipo_cabine";
};

export type AnteProjetoReport = {
  dryRun: boolean;
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
