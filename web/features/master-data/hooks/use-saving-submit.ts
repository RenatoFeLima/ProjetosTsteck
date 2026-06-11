"use client";

import { useState } from "react";

/**
 * Estado de gravação de formulários/modais: desabilita o botão durante o save
 * (bloqueia duplo clique), mostra "Salvando...", e em caso de erro mantém o
 * modal aberto exibindo a mensagem. Em caso de sucesso quem fecha o modal é o
 * chamador (onSave), como antes.
 */
export function useSavingSubmit() {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  /** Limpa o estado ao (re)abrir o modal. */
  function reset() {
    setSaving(false);
    setSaveError("");
  }

  /** Executa a ação de gravação com guarda de reentrância. */
  async function submit(action: () => void | Promise<unknown>) {
    if (saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await action();
      // Sucesso: o chamador fecha o modal; o estado é limpo no próximo open.
    } catch (e) {
      const msg = e instanceof Error && e.message.trim() ? e.message : "Não foi possível salvar. Tente novamente.";
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  }

  return { saving, saveError, reset, submit };
}
