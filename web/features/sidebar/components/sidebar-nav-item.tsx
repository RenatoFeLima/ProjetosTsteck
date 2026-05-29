"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as Tooltip from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";
import { useProjectsStore } from "@/features/projects/state/projects-store";
import type { NavItem } from "../nav-config";

type Props = {
  item: NavItem;
  collapsed: boolean;
};

export function SidebarNavItem({ item, collapsed }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const activeView = useProjectsStore((s) => s.activeView);
  const setActiveView = useProjectsStore((s) => s.setActiveView);
  const Icon = item.icon;

  const isActive = item.view
    ? pathname === "/" && activeView === item.view
    : pathname === item.href || pathname.startsWith(item.href + "/");

  function handleClick(e: React.MouseEvent) {
    if (item.view) {
      e.preventDefault();
      setActiveView(item.view);
      if (pathname !== "/") router.push("/");
    }
  }

  const linkContent = (
    <Link
      href={item.href}
      onClick={handleClick}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
        collapsed ? "justify-center px-0" : "",
        isActive
          ? "bg-brand/8 dark:bg-brand/15 text-brand"
          : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/5 hover:text-zinc-800 dark:hover:text-zinc-200",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {/* Indicador lateral ativo */}
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-brand" />
      )}
      <Icon
        size={17}
        className={cn(
          "shrink-0 transition-colors",
          isActive ? "text-brand" : "text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300",
        )}
      />
      {!collapsed && (
        <span className={cn("truncate text-[13px]", isActive ? "font-semibold" : "font-medium")}>
          {item.label}
        </span>
      )}
    </Link>
  );

  if (!collapsed) return linkContent;

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{linkContent}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="right"
            sideOffset={10}
            className="z-50 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xl"
          >
            {item.label}
            <Tooltip.Arrow className="fill-zinc-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
