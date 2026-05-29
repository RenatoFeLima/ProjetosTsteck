"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { AppSidebar } from "@/features/sidebar/components/app-sidebar";
import { useSidebar } from "@/features/sidebar/hooks/use-sidebar";
import { useCurrentUser } from "@/features/user/hooks/use-current-user";
import { PageTransition } from "@/features/ui/page-transition";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { collapsed, toggle } = useSidebar();
  const { user, clear } = useCurrentUser();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !user) {
      router.replace("/login");
    }
  }, [mounted, user, router]);

  // Aguarda hidratação e redireciona se não autenticado
  if (!mounted || !user) return null;

  function handleLogout() {
    clear();
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
          user={user}
          onIdentify={() => router.push("/login")}
          onLogout={handleLogout}
        />
      </div>

      <main className="flex flex-1 flex-col overflow-auto">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
