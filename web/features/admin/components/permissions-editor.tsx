"use client";

import { cn } from "@/lib/utils";
import type { UserPermissions } from "@/features/auth/lib/auth-types";

// ─── Definição dos grupos de permissões ───────────────────────────────────────

type PermItem = {
  label: string;
  category: keyof UserPermissions;
  field: string;
};

const GROUPS: { title: string; items: PermItem[] }[] = [
  {
    title: "Projetos",
    items: [
      { label: "Visualizar", category: "projects", field: "view" },
      { label: "Criar", category: "projects", field: "create" },
      { label: "Editar", category: "projects", field: "edit" },
      { label: "Excluir", category: "projects", field: "delete" },
      { label: "Alterar status", category: "projects", field: "changeStatus" },
      { label: "Marcar urgente", category: "projects", field: "markUrgent" },
      { label: "Ver histórico", category: "projects", field: "viewHistory" },
    ],
  },
  {
    title: "Kanban",
    items: [
      { label: "Visualizar", category: "kanban", field: "view" },
      { label: "Arrastar cartões", category: "kanban", field: "dragAndDrop" },
    ],
  },
  {
    title: "KPIs",
    items: [
      { label: "Visualizar", category: "kpis", field: "view" },
      { label: "Exportar", category: "kpis", field: "export" },
    ],
  },
  {
    title: "Alertas",
    items: [
      { label: "Visualizar", category: "alerts", field: "view" },
      { label: "Gerenciar", category: "alerts", field: "manage" },
    ],
  },
  {
    title: "Cadastros",
    items: [
      { label: "Visualizar", category: "masterData", field: "view" },
      { label: "Criar", category: "masterData", field: "create" },
      { label: "Editar", category: "masterData", field: "edit" },
      { label: "Excluir", category: "masterData", field: "delete" },
    ],
  },
  {
    title: "Usuários",
    items: [
      { label: "Visualizar", category: "users", field: "view" },
      { label: "Criar", category: "users", field: "create" },
      { label: "Editar", category: "users", field: "edit" },
      { label: "Excluir", category: "users", field: "delete" },
      { label: "Redefinir senha", category: "users", field: "resetPassword" },
      { label: "Gerenciar permissões", category: "users", field: "managePermissions" },
      { label: "Promover a admin", category: "users", field: "promoteAdmin" },
    ],
  },
  {
    title: "Configurações",
    items: [
      { label: "Visualizar", category: "settings", field: "view" },
      { label: "Editar", category: "settings", field: "edit" },
    ],
  },
  {
    title: "Auditoria",
    items: [
      { label: "Visualizar", category: "audit", field: "view" },
    ],
  },
];

// ─── Componente ───────────────────────────────────────────────────────────────

type PermissionsEditorProps = {
  permissions: UserPermissions;
  onChange: (updated: UserPermissions) => void;
  disabled?: boolean;
};

export function PermissionsEditor({ permissions, onChange, disabled = false }: PermissionsEditorProps) {
  function toggle(category: keyof UserPermissions, field: string) {
    if (disabled) return;
    const group = permissions[category] as Record<string, boolean>;
    const updated = { ...permissions, [category]: { ...group, [field]: !group[field] } };
    onChange(updated);
  }

  function isChecked(category: keyof UserPermissions, field: string): boolean {
    const group = permissions[category] as Record<string, boolean>;
    return group[field] ?? false;
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Permissões personalizadas
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {GROUPS.map((group) => (
          <div
            key={group.title}
            className="rounded-xl border border-zinc-200 dark:border-white/8 bg-zinc-50 dark:bg-panel-soft p-4"
          >
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {group.title}
            </p>
            <div className="space-y-2">
              {group.items.map((item) => {
                const checked = isChecked(item.category, item.field);
                const id = `perm-${item.category}-${item.field}`;
                return (
                  <label
                    key={id}
                    htmlFor={id}
                    className={cn(
                      "flex cursor-pointer select-none items-center gap-3 rounded-lg px-2 py-1.5 transition-colors",
                      !disabled && "hover:bg-white dark:hover:bg-panel",
                      disabled && "cursor-default opacity-70",
                    )}
                  >
                    <button
                      type="button"
                      id={id}
                      role="switch"
                      aria-checked={checked}
                      disabled={disabled}
                      onClick={() => toggle(item.category, item.field)}
                      className={cn(
                        "relative h-5 w-9 flex-shrink-0 rounded-full border-2 transition-all",
                        checked
                          ? "border-brand bg-brand"
                          : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-panel",
                        !disabled && "focus:outline-none focus:ring-2 focus:ring-brand/25 focus:ring-offset-1",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
                          checked ? "translate-x-3.5" : "translate-x-0.5",
                        )}
                      />
                    </button>
                    <span className="text-[13px] text-zinc-700 dark:text-zinc-300">{item.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
