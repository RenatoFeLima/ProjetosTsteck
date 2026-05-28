"use client";

import { useState } from "react";

export type UserRole = "Vendedor" | "Engenheiro" | "Gerente" | "Admin";

export type CurrentUser = {
  name: string;
  role: UserRole;
};

const STORAGE_KEY = "tsteck:current-user";

function readUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

function saveUser(user: CurrentUser) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(() => readUser());

  function identify(newUser: CurrentUser) {
    saveUser(newUser);
    setUser(newUser);
  }

  function clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setUser(null);
  }

  return { user, identify, clear };
}
