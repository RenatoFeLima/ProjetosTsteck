"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";

type Props = {
  className?: string;
};

export function ThemeToggle({ className }: Props) {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Modo claro" : "Modo escuro"}
      aria-label={isDark ? "Alternar para modo claro" : "Alternar para modo escuro"}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-150",
        "text-zinc-400 hover:bg-brand/10 hover:text-brand",
        "dark:text-zinc-500 dark:hover:bg-white/8 dark:hover:text-zinc-300",
        className,
      )}
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}
