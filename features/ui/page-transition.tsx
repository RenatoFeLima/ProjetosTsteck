"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Envolve o conteúdo de cada página com um fade-in suave ao trocar de rota.
 * Funciona no App Router: incrementa a key ao detectar mudança de pathname,
 * forçando remontagem da div e disparando a animação CSS.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [key, setKey] = useState(0);

  useEffect(() => {
    setKey((k) => k + 1);
  }, [pathname]);

  return (
    <div
      key={key}
      className="flex flex-1 flex-col"
      style={{ animation: "pageIn 220ms cubic-bezier(0.4,0,0.2,1) both" }}
    >
      {children}
    </div>
  );
}
