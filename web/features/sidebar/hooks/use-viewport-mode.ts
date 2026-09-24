"use client";

import { useSyncExternalStore } from "react";

/**
 * Faixa de tela do shell. Usado só onde o COMPORTAMENTO muda (rail forçada
 * compacta no tablet, drawer de navegação); o que é só visual fica em CSS.
 *   mobile  < 768px
 *   tablet  768–1023px
 *   desktop ≥ 1024px
 */
export type ViewportMode = "mobile" | "tablet" | "desktop";

// Mesmas fronteiras dos breakpoints md (768) e lg (1024) do Tailwind: CSS e JS
// trocam de faixa no mesmo pixel, sem "zona morta" em 767/768 ou 1023/1024.
const TABLET_QUERY = "(min-width: 768px)";
const DESKTOP_QUERY = "(min-width: 1024px)";

function hasMatchMedia() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

function getMode(): ViewportMode {
  if (!hasMatchMedia()) return "desktop";
  if (window.matchMedia(DESKTOP_QUERY).matches) return "desktop";
  if (window.matchMedia(TABLET_QUERY).matches) return "tablet";
  return "mobile";
}

function subscribe(onChange: () => void) {
  if (!hasMatchMedia()) return () => {};
  const lists = [window.matchMedia(TABLET_QUERY), window.matchMedia(DESKTOP_QUERY)];
  lists.forEach((list) => list.addEventListener("change", onChange));
  return () => lists.forEach((list) => list.removeEventListener("change", onChange));
}

export function useViewportMode(): ViewportMode {
  // Servidor/sem matchMedia: "desktop" (o shell só renderiza após a sessão carregar).
  return useSyncExternalStore(subscribe, getMode, () => "desktop");
}
