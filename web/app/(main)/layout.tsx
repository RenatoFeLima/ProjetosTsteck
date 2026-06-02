"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { AppSidebar } from "@/features/sidebar/components/app-sidebar";
import { useSidebar } from "@/features/sidebar/hooks/use-sidebar";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { ROLE_LABELS } from "@/features/auth/lib/permissions";
import { resolveRouteRule } from "@/features/auth/lib/route-permissions";
import { AccessDenied } from "@/features/auth/components/access-denied";
import type { CurrentUser } from "@/features/user/hooks/use-current-user";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { collapsed, toggle } = useSidebar();
  const { session, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!session) { router.replace("/login"); return; }
    if (session.user.mustChangePassword) { router.replace("/change-password"); }
  }, [isLoading, session, router]);

  // ── Controle de acesso por rota (bloqueia navegação para área sem permissão) ──
  const rule = session ? resolveRouteRule(pathname) : undefined;
  const accessDenied = !!(session && rule && !rule.check(session.user.permissions));

  // Registra a tentativa de acesso sem permissão no MySQL (uma vez por rota).
  const loggedPathRef = useRef<string | null>(null);
  useEffect(() => {
    if (!accessDenied || !rule) return;
    if (loggedPathRef.current === pathname) return;
    loggedPathRef.current = pathname;
    void fetch("/api/audit/access-denied", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: rule.label, path: pathname }),
    }).catch(() => {});
  }, [accessDenied, pathname, rule]);

  if (isLoading || !session || session.user.mustChangePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  // Converte a sessão para o formato esperado pela sidebar.
  const currentUser: CurrentUser = {
    name: session.user.name,
    role: ROLE_LABELS[session.user.role] ?? session.user.role,
  };

  function handleLogout() {
    logout();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen">
      {/* Sticky wrapper — cria o efeito de sidebar flutuante com margens */}
      <div
        className={cn(
          "sticky top-0 h-screen flex-shrink-0 p-3 transition-[width] duration-200",
          collapsed ? "w-[76px]" : "w-[248px]",
        )}
      >
        <AppSidebar
          collapsed={collapsed}
          onToggle={toggle}
          user={currentUser}
          onIdentify={() => router.push("/login")}
          onLogout={handleLogout}
        />
      </div>

      <main className="flex flex-1 flex-col">
        {accessDenied ? <AccessDenied area={rule?.label} /> : children}
      </main>
    </div>
  );
}
