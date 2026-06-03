"use client";

import { Loader2, AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Envólucro de estados (loading / erro) para as telas de Cadastros Mestres.
 * Quando carregado e sem erro, renderiza os filhos (a tabela, que já tem seu
 * próprio estado vazio profissional "Nenhum registro encontrado").
 */
export function MasterDataStates({
  loading,
  error,
  empty,
  entityLabel,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  entityLabel: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line bg-white dark:bg-panel py-16 text-zinc-400 dark:text-muted">
        <Loader2 size={24} className="animate-spin opacity-60" />
        <p className="text-sm">Carregando {entityLabel}s…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-200 dark:border-red-700/40 bg-red-50 dark:bg-red-900/20 py-16 text-red-600 dark:text-red-300">
        <AlertCircle size={26} className="opacity-70" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  void empty; // a tabela exibe o estado vazio internamente
  return <>{children}</>;
}
