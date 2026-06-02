"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  collapsed: boolean;
  onToggle: () => void;
};

export function SidebarBrand({ collapsed, onToggle }: Props) {
  return (
    <div
      className={cn(
        "relative flex items-center px-3 py-4",
        collapsed ? "justify-center" : "justify-between gap-2",
      )}
    >
      {collapsed ? (
        /* Modo recolhido: logo compacta, centralizada */
        <img
          src="/logo-tsteck.png"
          alt="TSTECK"
          className="h-7 w-auto max-w-[48px] object-contain select-none"
        />
      ) : (
        /* Modo expandido: logo completa */
        <img
          src="/logo-tsteck.png"
          alt="TSTECK"
          className="h-11 w-auto max-w-[150px] object-contain select-none"
        />
      )}

      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-zinc-400 dark:text-zinc-600 transition-all duration-150 hover:bg-brand/10 hover:text-brand dark:hover:bg-white/8 dark:hover:text-zinc-300",
          collapsed ? "absolute right-2 top-1/2 -translate-y-1/2" : "",
        )}
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>
    </div>
  );
}
