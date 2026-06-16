"use client";

import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/features/user/hooks/use-current-user";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { NAV_GROUPS } from "../nav-config";
import { SidebarBrand } from "./sidebar-brand";
import { SidebarNavGroup } from "./sidebar-nav-group";
import { SidebarUserProfile } from "./sidebar-user-profile";
import { ThemeToggle } from "@/features/ui/theme/theme-toggle";
import type { NavGroup } from "../nav-config";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
  user: CurrentUser | null;
  onIdentify: () => void;
  onLogout: () => void;
};

export function AppSidebar({ collapsed, onToggle, user, onIdentify, onLogout }: Props) {
  const { session } = useAuth();
  const perms = session?.user.permissions;
  const canManageUsers = perms?.users.view ?? false;

  const adminGroup: NavGroup = {
    title: "Administração",
    items: [
      { label: "Usuários", href: "/administracao/usuarios", icon: Users, permission: (p) => p.users.view },
    ],
  };

  // Esconde itens e grupos para os quais o usuário não tem permissão de visualização.
  const sourceGroups = canManageUsers ? [...NAV_GROUPS, adminGroup] : NAV_GROUPS;
  const allGroups = perms
    ? sourceGroups
        .map((g) => ({ ...g, items: g.items.filter((it) => !it.permission || it.permission(perms)) }))
        .filter((g) => g.items.length > 0)
    : [];

  return (
    <aside
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-panel",
        "border-zinc-200/70 dark:border-white/8",
        "shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)]",
      )}
      aria-label="Menu de navegação"
    >
      {/* Brand + toggle */}
      <SidebarBrand collapsed={collapsed} onToggle={onToggle} />

      <div className="mx-3 h-px bg-zinc-100 dark:bg-white/8" />

      {/* Navigation */}
      <nav
        className="flex flex-1 flex-col gap-5 overflow-y-auto py-4"
        aria-label="Navegação principal"
      >
        {allGroups.map((group, i) => (
          <SidebarNavGroup key={i} group={group} collapsed={collapsed} />
        ))}
      </nav>

      {/* Separator + theme toggle */}
      {collapsed ? (
        <>
          <div className="mx-3 h-px bg-zinc-100 dark:bg-white/8" />
          <div className="flex justify-center py-2">
            <ThemeToggle />
          </div>
        </>
      ) : (
        <div className="mx-3 mb-1 flex items-center gap-2">
          <div className="h-px flex-1 bg-zinc-100 dark:bg-white/8" />
          <ThemeToggle />
        </div>
      )}

      {/* User profile */}
      <div className="p-3">
        <SidebarUserProfile
          user={user}
          collapsed={collapsed}
          onIdentify={onIdentify}
          onLogout={onLogout}
        />
      </div>
    </aside>
  );
}
