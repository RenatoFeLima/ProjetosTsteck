"use client";

import { useContext } from "react";
import { AuthContext } from "../state/auth-context";

/**
 * Hook principal de autenticação.
 * Retorna sessão atual, estado de loading e ações de auth.
 */
export function useAuth() {
  return useContext(AuthContext);
}
