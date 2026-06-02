"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AuthContext } from "../state/auth-context";
import { mapApiUser, type ApiUser } from "../lib/api-user";
import type { AuthSession, LoginResult } from "../lib/auth-types";

/**
 * Provedor de autenticação — agora 100% integrado ao backend MySQL.
 * - A sessão é um cookie HTTP-only com JWT, emitido por /api/auth/login.
 * - Ao montar, /api/auth/me restaura a sessão (sobrevive a recarregar a página).
 * - Nenhum dado de usuário fica no localStorage/Zustand.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyUser = useCallback((apiUser: ApiUser | null) => {
    setSession(apiUser ? { user: mapApiUser(apiUser), loggedInAt: new Date().toISOString() } : null);
  }, []);

  // ── Restaura sessão do cookie ao montar ──────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { user?: ApiUser | null };
      applyUser(data.user ?? null);
    } catch {
      applyUser(null);
    }
  }, [applyUser]);

  useEffect(() => {
    (async () => {
      await refresh();
      setIsLoading(false);
    })();
  }, [refresh]);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(
    async (username: string, password: string): Promise<LoginResult> => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          user?: ApiUser;
          mustChangePassword?: boolean;
          error?: string;
        };
        if (!res.ok || !data.user) {
          return { ok: false, error: data.error ?? "Usuário ou senha inválidos." };
        }
        applyUser(data.user);
        return { ok: true, mustChangePassword: !!data.mustChangePassword };
      } catch {
        return { ok: false, error: "Não foi possível conectar ao servidor." };
      }
    },
    [applyUser],
  );

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    void fetch("/api/auth/logout", { method: "POST" }).finally(() => setSession(null));
  }, []);

  // ── Trocar senha ──────────────────────────────────────────────────────────
  const changePassword = useCallback(
    async (newPassword: string): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) return { ok: false, error: data.error ?? "Erro ao alterar senha." };
        await refresh();
        return { ok: true };
      } catch {
        return { ok: false, error: "Não foi possível conectar ao servidor." };
      }
    },
    [refresh],
  );

  // ── Atualizar sessão (revalida do servidor) ───────────────────────────────
  const refreshSession = useCallback(() => {
    void refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ session, isLoading, login, logout, changePassword, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}
