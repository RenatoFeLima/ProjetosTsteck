"use client";

import { LogOut, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/features/user/hooks/use-current-user";

type Props = {
  user: CurrentUser | null;
  collapsed: boolean;
  onIdentify: () => void;
  onLogout: () => void;
};

export function SidebarUserProfile({ user, collapsed, onIdentify, onLogout }: Props) {
  if (!user) {
    return (
      <button
        type="button"
        onClick={onIdentify}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl border border-dashed border-zinc-200 dark:border-white/15 px-3 py-2.5 text-[13px] text-zinc-400 dark:text-zinc-500 transition hover:border-brand/40 hover:bg-brand/5 hover:text-brand",
          collapsed ? "justify-center px-0 py-2.5" : "",
        )}
      >
        <UserCircle2 size={17} className="shrink-0" />
        {!collapsed && <span className="font-medium">Identificar-se</span>}
      </button>
    );
  }

  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1.5">
        <div className="relative">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-bold text-white shadow-sm"
            title={user.name}
          >
            {initials}
          </div>
          <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-panel bg-emerald-400" />
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 dark:text-zinc-500 transition hover:bg-brand/10 hover:text-brand"
          aria-label="Sair"
        >
          <LogOut size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-100 dark:border-white/8 bg-gradient-to-br from-zinc-50 to-white dark:from-white/[0.03] dark:to-transparent p-2.5">
      <div className="flex items-center gap-2.5">
        {/* Avatar com indicador online */}
        <div className="relative flex-shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-xs font-bold text-white shadow-sm">
            {initials}
          </div>
          <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-panel bg-emerald-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-zinc-900 dark:text-foreground">{user.name}</p>
          <p className="mt-0.5 text-[10px] font-medium text-zinc-400 dark:text-zinc-600">{user.role}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 dark:text-zinc-500 transition hover:bg-brand/10 hover:text-brand"
          aria-label="Sair"
        >
          <LogOut size={13} />
        </button>
      </div>
    </div>
  );
}
