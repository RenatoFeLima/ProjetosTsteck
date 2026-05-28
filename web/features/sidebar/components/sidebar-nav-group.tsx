"use client";

import { cn } from "@/lib/utils";
import type { NavGroup } from "../nav-config";
import { SidebarNavItem } from "./sidebar-nav-item";

type Props = {
  group: NavGroup;
  collapsed: boolean;
};

export function SidebarNavGroup({ group, collapsed }: Props) {
  return (
    <div className="flex flex-col gap-0.5">
      {group.title && !collapsed && (
        <div className="mb-1 flex items-center gap-2 px-3">
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-400">
            {group.title}
          </span>
          <div className="h-px flex-1 bg-zinc-100" />
        </div>
      )}
      {group.title && collapsed && (
        <div className={cn("mx-auto my-1 h-px w-6 bg-zinc-150")} />
      )}
      {group.items.map((item) => (
        <SidebarNavItem key={item.label} item={item} collapsed={collapsed} />
      ))}
    </div>
  );
}
