"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/use-auth";
import type { UserPermissions } from "../lib/auth-types";

// ─── RequireAuth ──────────────────────────────────────────────────────────────

/**
 * Protege qualquer rota interna.
 * Redireciona para /login se não autenticado.
 * Redireciona para /change-password se mustChangePassword = true.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (session.user.mustChangePassword) {
      router.replace("/change-password");
    }
  }, [isLoading, session, router]);

  if (isLoading || !session || session.user.mustChangePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}

// ─── RequirePermission ────────────────────────────────────────────────────────

type PermissionCheck = (perms: UserPermissions) => boolean;

type RequirePermissionProps = {
  check: PermissionCheck;
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * Renderiza children apenas se o usuário tiver a permissão especificada.
 * Exibe fallback (ou nada) se não tiver permissão.
 */
export function RequirePermission({ check, children, fallback }: RequirePermissionProps) {
  const { session } = useAuth();
  if (!session) return null;
  if (!check(session.user.permissions)) return <>{fallback ?? null}</>;
  return <>{children}</>;
}
