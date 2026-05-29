"use client";

import { SlidersHorizontal } from "lucide-react";

export default function ConfiguracoesPage() {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center gap-3">
        <SlidersHorizontal size={24} className="text-brand" />
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-foreground">Configurações</h1>
          <p className="text-sm text-zinc-500 dark:text-muted">Configurações gerais do sistema.</p>
        </div>
      </div>
      <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-white/15 bg-zinc-50 dark:bg-panel-soft px-8 py-16 text-center">
        <p className="text-sm text-zinc-400 dark:text-muted">Em breve.</p>
      </div>
    </div>
  );
}
