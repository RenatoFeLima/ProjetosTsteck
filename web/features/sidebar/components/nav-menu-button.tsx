"use client";

import Image from "next/image";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

/** id do painel de navegação completa (alvo do aria-controls). */
export const NAV_DRAWER_ID = "app-nav-drawer";

type Props = {
  expanded: boolean;
  /** Recebe o próprio botão, para o foco voltar a ele quando o menu fechar. */
  onOpen: (trigger: HTMLButtonElement) => void;
  className?: string;
};

/** Botão ☰ que abre a navegação completa (mobile e tablet). Alvo de 44×44px. */
export function NavMenuButton({ expanded, onOpen, className }: Props) {
  return (
    <button
      type="button"
      aria-label="Abrir menu"
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-controls={NAV_DRAWER_ID}
      onClick={(event) => onOpen(event.currentTarget)}
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-150",
        "text-zinc-500 hover:bg-brand/10 hover:text-brand dark:text-zinc-400 dark:hover:bg-white/8 dark:hover:text-zinc-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
        className,
      )}
    >
      <Menu size={18} />
    </button>
  );
}

/** Barra superior do celular (< 768px): ☰ + marca. As páginas mantêm seus próprios títulos. */
export function MobileTopBar({ expanded, onOpen }: Omit<Props, "className">) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-zinc-200/70 bg-panel/90 px-2 backdrop-blur-sm dark:border-white/8 md:hidden">
      <NavMenuButton expanded={expanded} onOpen={onOpen} />
      <Image src="/logo-tsteck.png" alt="TSTECK" width={1922} height={1084} className="h-7 w-auto object-contain select-none" />
    </header>
  );
}
