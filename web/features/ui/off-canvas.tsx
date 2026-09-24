"use client";

import type { ReactNode, RefObject } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";

type OffCanvasProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Título acessível do painel (visualmente oculto). */
  title: string;
  /** id do painel — use em `aria-controls` do botão que o abre. */
  id?: string;
  side?: "left" | "right";
  /** Elemento que recebe o foco ao fechar (normalmente o botão que abriu). */
  finalFocus?: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
};

/**
 * Painel lateral sobreposto (off-canvas) sobre o Dialog do Base UI.
 * O comportamento vem do primitivo — foco preso, foco inicial dentro do
 * painel, retorno de foco, ESC, clique no backdrop, aria-modal e trava de
 * scroll do documento (inclusive Safari/iOS). Aqui só entra o visual.
 * Reutilizável (ex.: filtros mobile).
 */
export function OffCanvas({
  open,
  onOpenChange,
  title,
  id,
  side = "left",
  finalFocus,
  className,
  children,
}: OffCanvasProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-[80] bg-black/45 transition-opacity duration-200 motion-reduce:transition-none",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0",
          )}
        />
        <Dialog.Popup
          id={id}
          // O Base UI já isola o resto da página (inert + aria-hidden); o
          // aria-modal explícito reforça a semântica para leitores de tela.
          aria-modal="true"
          finalFocus={finalFocus}
          className={cn(
            // min(85vw, 320px): sobra sempre uma faixa do backdrop visível.
            "fixed inset-y-0 z-[81] flex w-[min(85vw,320px)] flex-col outline-none",
            "transition-transform duration-200 ease-out motion-reduce:transition-none",
            side === "left"
              ? "left-0 data-[starting-style]:-translate-x-full data-[ending-style]:-translate-x-full"
              : "right-0 data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full",
            className,
          )}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Botão que fecha o OffCanvas (renderize dentro dele). */
export const OffCanvasClose = Dialog.Close;
