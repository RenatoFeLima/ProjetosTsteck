"use client";

import { createContext } from "react";
import type { AuthSession, LoginResult } from "../lib/auth-types";

export type AuthContextValue = {
  session: AuthSession | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  changePassword: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  refreshSession: (userId?: string) => void;
};

export const AuthContext = createContext<AuthContextValue>({
  session: null,
  isLoading: true,
  login: async () => ({ ok: false, error: "AuthProvider não inicializado." }),
  logout: () => {},
  changePassword: async () => ({ ok: false, error: "AuthProvider não inicializado." }),
  refreshSession: () => {},
});
