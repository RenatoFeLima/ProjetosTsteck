"use client";

import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/features/user/hooks/use-current-user";
import { NAV_GROUPS } from "../nav-config";
import { SidebarBrand } from "./sidebar-brand";
import { SidebarNavGroup } from "./sidebar-nav-group";
import { SidebarUserProfile } from "./sidebar-user-profile";
import { ThemeToggle } from "@/features/ui/theme/theme-toggle";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
  user: CurrentUser | null;
  onIdentify: () => void;
  onLogout: () => void;
};

export function AppSidebar({ collapsed, onToggle, user, onIdentify, onLogout }: Props) {
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
        {NAV_GROUPS.map((group, i) => (
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
