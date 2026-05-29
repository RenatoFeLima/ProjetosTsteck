"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Logo SVG (skyline de 3 torres — identidade TSTECK) ───────────────────────
function TsteckLogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 32"
      fill="none"
      aria-hidden="true"
    >
      {/* Torre esquerda */}
      <rect x="0" y="16" width="10" height="16" rx="1.5" fill="#9e0b0f" />
      <rect x="2"  y="18" width="3"  height="2.5" rx="0.4" fill="white" opacity="0.65" />
      <rect x="2"  y="22" width="3"  height="2.5" rx="0.4" fill="white" opacity="0.65" />
      <rect x="6"  y="18" width="2"  height="2.5" rx="0.4" fill="white" opacity="0.55" />
      {/* Torre central (mais alta) */}
      <rect x="13" y="6"  width="10" height="26" rx="1.5" fill="#9e0b0f" />
      <rect x="15" y="9"  width="3"  height="2.5" rx="0.4" fill="white" opacity="0.65" />
      <rect x="15" y="14" width="3"  height="2.5" rx="0.4" fill="white" opacity="0.65" />
      <rect x="15" y="19" width="3"  height="2.5" rx="0.4" fill="white" opacity="0.65" />
      <rect x="20" y="9"  width="2"  height="2.5" rx="0.4" fill="white" opacity="0.55" />
      {/* Torre direita */}
      <rect x="26" y="11" width="10" height="21" rx="1.5" fill="#9e0b0f" />
      <rect x="28" y="13" width="3"  height="2.5" rx="0.4" fill="white" opacity="0.65" />
      <rect x="28" y="18" width="3"  height="2.5" rx="0.4" fill="white" opacity="0.65" />
      <rect x="28" y="23" width="3"  height="2.5" rx="0.4" fill="white" opacity="0.65" />
      <rect x="33" y="13" width="2"  height="2.5" rx="0.4" fill="white" opacity="0.55" />
    </svg>
  );
}

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
        /* Modo recolhido: apenas o ícone de torres, centralizado */
        <TsteckLogoMark size={22} />
      ) : (
        /* Modo expandido: ícone + wordmark + subtítulo */
        <div className="flex items-center gap-2.5 min-w-0">
          <TsteckLogoMark size={22} />
          <div className="flex flex-col min-w-0">
            <span
              className="text-[1.2rem] font-bold tracking-[0.15em] text-brand leading-none select-none"
              style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}
            >
              TSTECK
            </span>
            <span className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-600 leading-tight truncate">
              Engenharia Operacional
            </span>
          </div>
        </div>
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

