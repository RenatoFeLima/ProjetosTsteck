// Contrato do relatório de importação do legado. Compartilhado entre o serviço
// (servidor) e a tela admin (cliente).

export type ImportSource = "CADASTRO_INICIAL" | "ANTE_PROJETO";

export type ConstructorToCreate = { name: string };

export type WorkToCreate = { construtora: string; obra: string };

export type ProjectToCreate = {
  code: string;
  construtora: string;
  obra: string;
  status: string; // DbStatus
  statusLabel: string; // rótulo PT-BR
  temp: boolean; // código provisório CRE-TMP-####
  urgente: boolean;
  source: ImportSource;
};

export type SkippedProject = {
  code: string;
  construtora: string;
  obra: string;
  source: ImportSource;
  reason: string;
};

export type RefNotFound = { construtora: string; obra: string; valor: string; source: ImportSource; suggestion?: string };

export type DateErrorItem = {
  source: ImportSource;
  field: string;
  raw: string;
  construtora: string;
  obra: string;
};

export type ImportReport = {
  dryRun: boolean;
  rowsRead: { cadastroInicial: number; anteProjeto: number };
  constructorsToCreate: ConstructorToCreate[];
  worksToCreate: WorkToCreate[];
  worksExistingMatched: number;
  worksDuplicateInFile: number;
  worksSkippedEmpty: { construtora: string; source: ImportSource }[];
  projectsToCreate: ProjectToCreate[];
  projectsSkippedDuplicate: SkippedProject[];
  sellersNotFound: RefNotFound[];
  equipmentNotFound: RefNotFound[];
  cabinTypesNotFound: RefNotFound[];
  engineersInline: string[]; // nomes (limpos) gravados direto no projeto, sem cadastro
  tempCodesAssigned: number;
  statusUrgentAssumed: { construtora: string; obra: string }[];
  dateErrors: DateErrorItem[];
  committed?: { constructors: number; works: number; projects: number };
};
