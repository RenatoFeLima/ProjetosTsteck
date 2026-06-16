"use client";

import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";

/**
 * Tela de acesso negado.
 * Exibida quando o usuário autenticado tenta acessar uma rota para a qual não
 * possui permissão (inclusive via URL direta).
 */
export function AccessDenied({ area }: { area?: string }) {
  const router = useRouter();

  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-900/20">
        <ShieldAlert size={30} className="text-red-600 dark:text-red-400" />
      </div>
      <h1 className="mt-5 text-[18px] font-semibold text-zinc-900 dark:text-foreground">
        Acesso não autorizado
      </h1>
      <p className="mt-1.5 max-w-md text-[13px] text-zinc-500 dark:text-muted">
        Você não possui permissão para acessar
        {area ? <> a área <span className="font-medium text-zinc-700 dark:text-zinc-300">{area}</span></> : " esta área"}.
        Caso acredite que isto é um engano, fale com um administrador.
      </p>
      <button
        onClick={() => router.push("/")}
        className="mt-6 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-brand/90 active:scale-[0.99]"
      >
        Voltar para Projetos
      </button>
    </div>
  );
}
