// ─── Base ─────────────────────────────────────────────────────────────────────

export type MasterEntity = {
  id: string;
  active: boolean;
  createdAt: string; // "yyyy-MM-dd"
  updatedAt: string;
  createdBy: string;
};

// ─── Entidades ────────────────────────────────────────────────────────────────

export type Construtora = MasterEntity & {
  name: string;
  cnpj?: string;
  phone?: string;
  email?: string;
  notes?: string;
};

export type Obra = MasterEntity & {
  construtoraName: string; // FK por nome (mantém compatibilidade com Project.construtora)
  name: string;
  address?: string;
  city?: string;
  state?: string;
  notes?: string;
};

export type Equipamento = MasterEntity & {
  code: string; // chave única, uppercase
  description?: string;
  family?: string;
  capacity?: string;
  dimension?: string;
  notes?: string;
};

export type TipoCabine = MasterEntity & {
  name: string;
  description?: string;
};

export type Vendedor = MasterEntity & {
  name: string;
  email?: string;
  phone?: string;
};

export type Engenheiro = MasterEntity & {
  name: string; // prefixado "Engº"
  phone?: string;
  email?: string;
};

// ─── Auditoria ────────────────────────────────────────────────────────────────

export type AuditEntityType =
  | "construtora"
  | "obra"
  | "equipamento"
  | "tipoCabine"
  | "vendedor"
  | "engenheiro";

export type AuditAction = "created" | "updated" | "activated" | "deactivated" | "deleted";

export type AuditEvent = {
  id: string;
  entity: AuditEntityType;
  entityId: string;
  entityName: string;
  action: AuditAction;
  performedBy: string;
  performedAt: string; // ISO datetime
  previousValue?: string;
  newValue?: string;
};
