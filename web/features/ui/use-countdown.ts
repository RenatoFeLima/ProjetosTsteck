"use client";

import { useEffect, useState } from "react";

/**
 * Segundos restantes até `deadline` (epoch ms), atualizando a cada segundo.
 * Retorna 0 quando não há bloqueio ativo.
 *
 * É APENAS UX: o backend continua sendo a fonte de verdade do bloqueio. Quando
 * o contador zera, a UI só volta a permitir uma nova tentativa — quem decide se
 * ela passa é o rate limiter no servidor.
 *
 * `Date.now()` fica fora do render (é impuro): o "agora" vive em estado e é
 * atualizado pelo intervalo. Até o primeiro tick chegar, devolvemos
 * `initialSeconds` — assim o bloqueio vale já no primeiro render, sem
 * nenhuma janela em que o botão apareça habilitado por engano.
 */
export function useCountdown(deadline: number | null, initialSeconds = 0): number {
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (deadline === null) return;
    const sync = () => setNow(Date.now());
    const immediate = setTimeout(sync, 0);
    const interval = setInterval(sync, 1000);
    return () => {
      clearTimeout(immediate);
      clearInterval(interval);
    };
  }, [deadline]);

  if (deadline === null) return 0;
  if (now === 0) return Math.max(0, Math.ceil(initialSeconds));
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
