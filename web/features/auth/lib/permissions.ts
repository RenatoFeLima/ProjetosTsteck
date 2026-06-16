import type { UserPermissions, UserRole } from "./auth-types";

export const FULL_PERMISSIONS: UserPermissions = {
  projects: { view: true, create: true, edit: true, delete: true, changeStatus: true, markUrgent: true, viewHistory: true },
  kanban: { view: true, dragAndDrop: true },
  kpis: { view: true, export: true },
  alerts: { view: true, manage: true },
  masterData: { view: true, create: true, edit: true, delete: true },
  users: { view: true, create: true, edit: true, delete: true, resetPassword: true, managePermissions: true, promoteAdmin: true },
  settings: { view: true, edit: true },
  audit: { view: true },
};

export const VIEWER_PERMISSIONS: UserPermissions = {
  projects: { view: true, create: false, edit: false, delete: false, changeStatus: false, markUrgent: false, viewHistory: true },
  kanban: { view: true, dragAndDrop: false },
  kpis: { view: true, export: false },
  alerts: { view: true, manage: false },
  masterData: { view: true, create: false, edit: false, delete: false },
  users: { view: false, create: false, edit: false, delete: false, resetPassword: false, managePermissions: false, promoteAdmin: false },
  settings: { view: false, edit: false },
  audit: { view: false },
};

export const MANAGER_PERMISSIONS: UserPermissions = {
  projects: { view: true, create: true, edit: true, delete: false, changeStatus: true, markUrgent: true, viewHistory: true },
  kanban: { view: true, dragAndDrop: true },
  kpis: { view: true, export: true },
  alerts: { view: true, manage: true },
  masterData: { view: true, create: true, edit: true, delete: false },
  users: { view: false, create: false, edit: false, delete: false, resetPassword: false, managePermissions: false, promoteAdmin: false },
  settings: { view: true, edit: false },
  audit: { view: false },
};

export const PROJECTS_PERMISSIONS: UserPermissions = {
  projects: { view: true, create: true, edit: true, delete: false, changeStatus: true, markUrgent: false, viewHistory: true },
  kanban: { view: true, dragAndDrop: true },
  kpis: { view: true, export: false },
  alerts: { view: true, manage: false },
  masterData: { view: true, create: false, edit: false, delete: false },
  users: { view: false, create: false, edit: false, delete: false, resetPassword: false, managePermissions: false, promoteAdmin: false },
  settings: { view: false, edit: false },
  audit: { view: false },
};

export const COMMERCIAL_PERMISSIONS: UserPermissions = {
  projects: { view: true, create: true, edit: true, delete: false, changeStatus: false, markUrgent: false, viewHistory: true },
  kanban: { view: true, dragAndDrop: false },
  kpis: { view: true, export: false },
  alerts: { view: true, manage: false },
  masterData: { view: true, create: false, edit: false, delete: false },
  users: { view: false, create: false, edit: false, delete: false, resetPassword: false, managePermissions: false, promoteAdmin: false },
  settings: { view: false, edit: false },
  audit: { view: false },
};

export function getDefaultPermissions(role: UserRole): UserPermissions {
  switch (role) {
    case "ADMIN":      return FULL_PERMISSIONS;
    case "MANAGER":    return MANAGER_PERMISSIONS;
    case "PROJECTS":   return PROJECTS_PERMISSIONS;
    case "COMMERCIAL": return COMMERCIAL_PERMISSIONS;
    case "VIEWER":     return VIEWER_PERMISSIONS;
    case "CUSTOM":     return VIEWER_PERMISSIONS; // começa com viewer, admin personaliza
    default:           return VIEWER_PERMISSIONS;
  }
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN:      "Administrador",
  MANAGER:    "Gerente",
  PROJECTS:   "Projetos",
  COMMERCIAL: "Comercial",
  VIEWER:     "Visualizador",
  CUSTOM:     "Personalizado",
};

export const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN:      "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 border-red-200 dark:border-red-800/40",
  MANAGER:    "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800/40",
  PROJECTS:   "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300 border-violet-200 dark:border-violet-800/40",
  COMMERCIAL: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800/40",
  VIEWER:     "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700",
  CUSTOM:     "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40",
};
