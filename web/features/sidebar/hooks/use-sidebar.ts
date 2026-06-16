"use client";

import { useState } from "react";

const STORAGE_KEY = "tsteck:sidebar-collapsed";

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function useSidebar() {
  const [collapsed, setCollapsed] = useState<boolean>(() => readCollapsed());

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  return { collapsed, toggle };
}
