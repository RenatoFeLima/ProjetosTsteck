"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AppSidebar } from "@/features/sidebar/components/app-sidebar";
import { MobileTopBar, NAV_DRAWER_ID, NavMenuButton } from "@/features/sidebar/components/nav-menu-button";
import { useSidebar } from "@/features/sidebar/hooks/use-sidebar";
import { useViewportMode } from "@/features/sidebar/hooks/use-viewport-mode";
import { OffCanvas, OffCanvasClose } from "@/features/ui/off-canvas";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { ROLE_LABELS } from "@/features/auth/lib/permissions";
import { resolveRouteRule } from "@/features/auth/lib/route-permissions";
import { AccessDenied } from "@/features/auth/components/access-denied";
import type { CurrentUser } from "@/features/user/hooks/use-current-user";
import { apiFetch } from "@/lib/api-client";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // Preferência do DESKTOP (localStorage). Tablet/mobile nunca a alteram.
  const { collapsed, toggle } = useSidebar();
  const { session, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // ── Shell responsivo ────────────────────────────────────────────────────────
  // desktop ≥1024: sidebar atual (248/76, preferência salva)
  // tablet 768–1023: rail compacta de 76px + ☰ para a navegação completa
  // mobile <768: sem sidebar no layout; barra ☰ + navegação completa sobreposta
  const viewportMode = useViewportMode();
  // Drawer aberto é estado TRANSITÓRIO (nunca persistido).
  const [navOpen, setNavOpen] = useState(false);
  // Ao trocar de faixa, o drawer volta fechado (sem estado fantasma ao ir
  // 390 → 1920 → 390). Ajuste de estado durante a renderização, padrão do React.
  const [navMode, setNavMode] = useState(viewportMode);
  if (navMode !== viewportMode) {
    setNavMode(viewportMode);
    setNavOpen(false);
  }
  // Botão que abriu o menu: recebe o foco de volta quando ele fecha.
  const menuTriggerRef = useRef<HTMLElement | null>(null);
  const drawerOpen = navOpen && viewportMode !== "desktop";
  function openNav(trigger: HTMLElement) {
    menuTriggerRef.current = trigger;
    setNavOpen(true);
  }

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
    void apiFetch("/api/audit/access-denied", {
      method: "POST",
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

  const isTablet = viewportMode === "tablet";

  return (
    <div className="flex min-h-screen">
      {/* Sticky wrapper — cria o efeito de sidebar flutuante com margens.
          Largura/visibilidade em CSS (sem piscar): some < md, 76px no tablet,
          248/76 no desktop conforme a preferência salva. */}
      {viewportMode !== "mobile" && (
        <div
          className={cn(
            "sticky top-0 hidden h-screen flex-shrink-0 p-3 transition-[width] duration-200 md:block md:w-[76px]",
            collapsed ? "lg:w-[76px]" : "lg:w-[248px]",
          )}
        >
          <AppSidebar
            collapsed={isTablet || collapsed}
            onToggle={isTablet ? undefined : toggle}
            brandAction={isTablet ? <NavMenuButton expanded={drawerOpen} onOpen={openNav} /> : undefined}
            user={currentUser}
            onIdentify={() => router.push("/login")}
            onLogout={handleLogout}
          />
        </div>
      )}

      {/* min-w-0: sem ele o flex item não encolhe abaixo do conteúdo mais largo
          (ex.: tabelas) e a página inteira ganha rolagem horizontal. */}
      <main className="flex min-w-0 flex-1 flex-col">
        {viewportMode === "mobile" && <MobileTopBar expanded={drawerOpen} onOpen={openNav} />}
        {accessDenied ? <AccessDenied area={rule?.label} /> : children}
      </main>

      {/* Navegação completa sobreposta (mobile e tablet). Foco, ESC, backdrop,
          aria-modal e trava de scroll vêm do Dialog do Base UI. */}
      <OffCanvas
        open={drawerOpen}
        onOpenChange={setNavOpen}
        id={NAV_DRAWER_ID}
        title="Menu de navegação"
        finalFocus={menuTriggerRef}
        className="p-3"
      >
        <AppSidebar
          collapsed={false}
          brandAction={
            <OffCanvasClose
              aria-label="Fechar menu"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 dark:text-zinc-400 dark:hover:bg-white/8 dark:hover:text-zinc-200"
            >
              <X size={18} />
            </OffCanvasClose>
          }
          onNavigate={() => setNavOpen(false)}
          user={currentUser}
          onIdentify={() => router.push("/login")}
          onLogout={handleLogout}
        />
      </OffCanvas>
    </div>
  );
}
