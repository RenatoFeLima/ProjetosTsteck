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
        "flex items-center px-3 py-4",
        collapsed ? "justify-center" : "justify-between gap-2",
      )}
    >
      {collapsed ? (
        <span
          className="text-base font-bold tracking-widest text-brand leading-none select-none"
          style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}
        >
          TS
        </span>
      ) : (
        <div className="flex flex-col">
          <span
            className="text-[1.25rem] font-bold tracking-[0.15em] text-brand leading-none select-none"
            style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}
          >
            TSTECK
          </span>
          <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-400 leading-tight">
            Engenharia Operacional
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-all hover:bg-brand/10 hover:text-brand",
          collapsed ? "ml-auto" : "",
        )}
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>
    </div>
  );
}
