import { cn } from "@/lib/utils";

/** Bloco de carregamento (placeholder) no padrão visual já usado no sistema. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-lg bg-zinc-100 dark:bg-white/8", className)} />;
}
