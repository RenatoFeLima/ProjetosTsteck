"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { hashPassword, verifyPassword } from "../lib/password-utils";
import { useUsersStore } from "../state/users-store";
import { AuthContext } from "../state/auth-context";
import type { AuthSession, LoginResult } from "../lib/auth-types";

/**
 * Provedor de autenticação.
 * - Sessão mantida APENAS em memória (React state).
 * - Ao recarregar a página, a sessão é perdida e o usuário volta para /login.
 * - Dados de usuários (com hash) são persistidos via Zustand no localStorage.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const seeded = useUsersStore((s) => s.seeded);
  const seed = useUsersStore((s) => s.seed);
  const getUserByUsername = useUsersStore((s) => s.getUserByUsername);
  const recordLogin = useUsersStore((s) => s.recordLogin);
  const addAuditLog = useUsersStore((s) => s.addAuditLog);
  const setPasswordHash = useUsersStore((s) => s.setPasswordHash);

  // ── Inicialização: seed do admin inicial ─────────────────────────────────
  useEffect(() => {
    async function init() {
      if (!seeded) {
        const hash = await hashPassword("172631");
        seed(hash);
      }
      setIsLoading(false);
    }
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(
    async (username: string, password: string): Promise<LoginResult> => {
      const user = getUserByUsername(username);

      if (!user || !user.active) {
        addAuditLog({
          action: "LOGIN_FAILED",
          message: `Tentativa de login com usuário "${username}" — não encontrado ou inativo.`,
        });
        return { ok: false, error: "Usuário ou senha inválidos." };
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        addAuditLog({
          action: "LOGIN_FAILED",
          actorUserId: user.id,
          actorName: user.name,
          message: `Login negado para ${user.name} — senha incorreta.`,
        });
        return { ok: false, error: "Usuário ou senha inválidos." };
      }

      recordLogin(user.id);
      addAuditLog({
        action: "LOGIN",
        actorUserId: user.id,
        actorName: user.name,
        message: `${user.name} realizou login.`,
      });

      // Lê usuário atualizado após recordLogin
      const fresh = useUsersStore.getState().getUserByUsername(username)!;
      setSession({ user: { ...fresh }, loggedInAt: new Date().toISOString() });
      return { ok: true, mustChangePassword: fresh.mustChangePassword };
    },
    [getUserByUsername, addAuditLog, recordLogin],
  );

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    if (session) {
      addAuditLog({
        action: "LOGOUT",
        actorUserId: session.user.id,
        actorName: session.user.name,
        message: `${session.user.name} realizou logout.`,
      });
    }
    setSession(null);
  }, [session, addAuditLog]);

  // ── Trocar senha ──────────────────────────────────────────────────────────
  const changePassword = useCallback(
    async (newPassword: string): Promise<{ ok: boolean; error?: string }> => {
      if (!session) return { ok: false, error: "Sessão inválida." };
      const hash = await hashPassword(newPassword);
      setPasswordHash(session.user.id, hash, false, session.user.id, session.user.name);
      const updated = useUsersStore.getState().getUserByUsername(session.user.username);
      if (updated) setSession((prev) => (prev ? { ...prev, user: { ...updated } } : null));
      return { ok: true };
    },
    [session, setPasswordHash],
  );

  // ── Atualizar sessão após mudança de dados ────────────────────────────────
  const refreshSession = useCallback(
    (userId: string) => {
      const updated = useUsersStore.getState().getUserById(userId);
      if (updated && session) {
        setSession((prev) => (prev ? { ...prev, user: { ...updated } } : null));
      }
    },
    [session],
  );

  return (
    <AuthContext.Provider value={{ session, isLoading, login, logout, changePassword, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}
