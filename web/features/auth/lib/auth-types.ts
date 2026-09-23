// Tipos centrais de autenticação, autorização e auditoria.
// Este arquivo não deve importar nada externo ao auth feature.

export type UserRole = "ADMIN" | "MANAGER" | "PROJECTS" | "COMMERCIAL" | "SELLER" | "VIEWER" | "CUSTOM";

export type UserPermissions = {
  projects: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    changeStatus: boolean;
    markUrgent: boolean;
    viewHistory: boolean;
  };
  kanban: {
    view: boolean;
    dragAndDrop: boolean;
  };
  kpis: {
    view: boolean;
    export: boolean;
  };
  alerts: {
    view: boolean;
    manage: boolean;
  };
  masterData: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  };
  users: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    resetPassword: boolean;
    managePermissions: boolean;
    promoteAdmin: boolean;
  };
  settings: {
    view: boolean;
    edit: boolean;
  };
  audit: {
    view: boolean;
  };
};

export type User = {
  id: string;
  username: string;
  name: string;
  email?: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  mustChangePassword: boolean;
  permissions: UserPermissions;
  /** Vendedor vinculado (quando role=SELLER). */
  sellerId?: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  createdBy?: string;
  updatedBy?: string;
};

export type AuditLog = {
  id: string;
  action: string;
  actorUserId?: string;
  actorName?: string;
  targetUserId?: string;
  targetName?: string;
  entityType?: string;
  entityId?: string;
  message: string;
  createdAt: string;
};

export type AuthSession = {
  user: User;
  loggedInAt: string;
};

/** Falha de login já normalizada. Carrega o CÓDIGO técnico (não a frase) para
 *  que a tela traduza pelo catálogo central — ver lib/errors/error-catalog. */
export type LoginFailure = {
  ok: false;
  /** Código técnico do backend. NUNCA deve ser exibido cru ao usuário. */
  code: string | null;
  /** Mensagem amigável enviada pelo backend, quando houver. */
  message: string | null;
  /** Status HTTP (0 quando a requisição nem chegou ao servidor). */
  status: number;
  /** Correlation id do backend (500/503) — uso interno, NÃO é exibido na UI. */
  requestId: string | null;
  /** Segundos de bloqueio (429). */
  retryAfterSeconds: number | null;
};

export type LoginResult = { ok: true; mustChangePassword: boolean } | LoginFailure;
