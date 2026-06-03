// Chaves das entidades de Cadastros Mestres — módulo client-safe (sem Prisma).
// Compartilhado entre cliente (hook/API) e servidor (service).

export type MasterEntityKey =
  | "construtoras"
  | "obras"
  | "equipamentos"
  | "tiposCabine"
  | "vendedores"
  | "engenheiros";

export const MASTER_ENTITY_KEYS: MasterEntityKey[] = [
  "construtoras",
  "obras",
  "equipamentos",
  "tiposCabine",
  "vendedores",
  "engenheiros",
];
