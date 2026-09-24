"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  collapsed: boolean;
  /** Recolher/expandir (desktop). Ausente quando a rail é forçada compacta. */
  onToggle?: () => void;
  /** Ação no lugar do recolher/expandir: ☰ na rail do tablet, X no drawer. */
  action?: ReactNode;
};

export function SidebarBrand({ collapsed, onToggle, action }: Props) {
  const logo = collapsed ? (
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
  );

  // Rail compacta com ação própria (☰ do tablet): logo e botão empilhados,
  // pois a ação de 44px não cabe ao lado da logo em 52px de largura.
  if (action && collapsed) {
    return <div className="flex flex-col items-center gap-2 px-3 py-4">{logo}{action}</div>;
  }

  return (
    <div
      className={cn(
        "relative flex items-center px-3 py-4",
        collapsed ? "justify-center pointer-coarse:flex-col pointer-coarse:gap-1" : "justify-between gap-2",
      )}
    >
      {logo}

      {action ??
        (onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-zinc-400 dark:text-zinc-600 transition-all duration-150 hover:bg-brand/10 hover:text-brand dark:hover:bg-white/8 dark:hover:text-zinc-300",
              // Toque: alvo de 44px (o ícone continua pequeno).
              "pointer-coarse:h-11 pointer-coarse:w-11",
              collapsed
                ? "absolute right-2 top-1/2 -translate-y-1/2 pointer-coarse:static pointer-coarse:translate-y-0"
                : "",
            )}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        ))}
    </div>
  );
}
