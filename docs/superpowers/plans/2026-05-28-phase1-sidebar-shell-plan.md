# Fase 1 — Shell + Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o layout de aplicação com sidebar de navegação, hooks de identidade do usuário e stubs das rotas de master data — sem tocar em nenhuma lógica de projetos existente.

**Architecture:** Route group `(main)` agrupa todas as rotas com sidebar. `AppSidebar` é Client Component com estado `collapsed` persistido em localStorage via `useSidebar`. `useCurrentUser` lê/escreve `localStorage`. `IdentificationModal` aparece somente quando `user === null`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, `@radix-ui/react-tooltip`, lucide-react, Vitest + Testing Library.

---

## File Structure

| Operação | Arquivo |
|---|---|
| MOVE | `app/page.tsx` → `app/(main)/page.tsx` |
| CREATE | `app/(main)/layout.tsx` |
| CREATE | `features/sidebar/hooks/use-sidebar.ts` |
| CREATE | `features/sidebar/components/sidebar-nav-item.tsx` |
| CREATE | `features/sidebar/components/sidebar-nav-group.tsx` |
| CREATE | `features/sidebar/components/sidebar-brand.tsx` |
| CREATE | `features/sidebar/components/sidebar-user-profile.tsx` |
| CREATE | `features/sidebar/components/app-sidebar.tsx` |
| CREATE | `features/user/hooks/use-current-user.ts` |
| CREATE | `features/user/components/identification-modal.tsx` |
| CREATE | `app/(main)/master/construtoras/page.tsx` (stub) |
| CREATE | `app/(main)/master/obras/page.tsx` (stub) |
| CREATE | `app/(main)/master/equipamentos/page.tsx` (stub) |
| CREATE | `app/(main)/master/tipos-cabine/page.tsx` (stub) |
| CREATE | `app/(main)/master/vendedores/page.tsx` (stub) |
| CREATE | `app/(main)/master/engenheiros/page.tsx` (stub) |
| CREATE | `app/(main)/master/auditoria/page.tsx` (stub) |
| CREATE | `tests/sidebar/use-sidebar.test.ts` |
| CREATE | `tests/user/use-current-user.test.ts` |

---

### Task 1: Instalar dependência + mover page.tsx

**Files:**
- Install: `@radix-ui/react-tooltip`
- Move: `app/page.tsx` → `app/(main)/page.tsx`

- [ ] **Step 1: Instalar @radix-ui/react-tooltip**

No diretório `web/`, executar:

```bash
cd web
npm install @radix-ui/react-tooltip
```

Expected: `added 1 package` (ou similar), sem erros.

- [ ] **Step 2: Criar diretório e mover page.tsx**

```bash
mkdir -p app/\(main\)
mv app/page.tsx app/\(main\)/page.tsx
```

No Windows PowerShell:
```powershell
New-Item -ItemType Directory -Path "app/(main)" -Force
Move-Item -Path "app/page.tsx" -Destination "app/(main)/page.tsx"
```

Expected: `app/(main)/page.tsx` existe com conteúdo:
```tsx
import { ProjectsPageShell } from "@/features/projects/components/projects-page-shell";

export default function HomePage() {
  return <ProjectsPageShell />;
}
```

- [ ] **Step 3: Verificar que app/page.tsx não existe mais**

```powershell
Test-Path "app/page.tsx"
```

Expected: `False`

- [ ] **Step 4: Commit**

```bash
git add app/(main)/page.tsx
git rm app/page.tsx
git commit -m "refactor: move app/page.tsx into route group (main)"
```

---

### Task 2: `useSidebar` hook + testes

**Files:**
- Create: `features/sidebar/hooks/use-sidebar.ts`
- Create: `tests/sidebar/use-sidebar.test.ts`

- [ ] **Step 1: Escrever o teste que deve falhar**

Criar `web/tests/sidebar/use-sidebar.test.ts`:

```typescript
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useSidebar } from "@/features/sidebar/hooks/use-sidebar";

const STORAGE_KEY = "tsteck:sidebar-collapsed";

describe("useSidebar", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("starts expanded (false) when localStorage is empty", () => {
    const { result } = renderHook(() => useSidebar());
    expect(result.current.collapsed).toBe(false);
  });

  it("reads initial state from localStorage", () => {
    localStorage.setItem(STORAGE_KEY, "true");
    const { result } = renderHook(() => useSidebar());
    expect(result.current.collapsed).toBe(true);
  });

  it("toggle inverts collapsed and persists to localStorage", () => {
    const { result } = renderHook(() => useSidebar());
    expect(result.current.collapsed).toBe(false);

    act(() => result.current.toggle());

    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");

    act(() => result.current.toggle());

    expect(result.current.collapsed).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("false");
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
npm test -- tests/sidebar/use-sidebar.test.ts
```

Expected: `FAIL` com "Cannot find module '@/features/sidebar/hooks/use-sidebar'".

- [ ] **Step 3: Implementar o hook**

Criar `web/features/sidebar/hooks/use-sidebar.ts`:

```typescript
"use client";

import { useCallback, useState } from "react";

const STORAGE_KEY = "tsteck:sidebar-collapsed";

function readStoredCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

export function useSidebar() {
  const [collapsed, setCollapsed] = useState<boolean>(readStoredCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, String(next));
      }
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

```bash
npm test -- tests/sidebar/use-sidebar.test.ts
```

Expected: `PASS` — 3 testes passando.

- [ ] **Step 5: Commit**

```bash
git add features/sidebar/hooks/use-sidebar.ts tests/sidebar/use-sidebar.test.ts
git commit -m "feat: add useSidebar hook with localStorage persistence"
```

---

### Task 3: `useCurrentUser` hook + testes

**Files:**
- Create: `features/user/hooks/use-current-user.ts`
- Create: `tests/user/use-current-user.test.ts`

- [ ] **Step 1: Escrever o teste que deve falhar**

Criar `web/tests/user/use-current-user.test.ts`:

```typescript
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { useCurrentUser } from "@/features/user/hooks/use-current-user";
import type { CurrentUser } from "@/features/user/hooks/use-current-user";

const STORAGE_KEY = "tsteck:current-user";

describe("useCurrentUser", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when localStorage is empty", () => {
    const { result } = renderHook(() => useCurrentUser());
    expect(result.current.user).toBeNull();
  });

  it("reads stored user from localStorage on mount", () => {
    const stored: CurrentUser = { name: "Ana Lima", role: "projetista", initials: "AL" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() => useCurrentUser());
    expect(result.current.user).toEqual(stored);
  });

  it("saveUser persists to localStorage and derives initials", () => {
    const { result } = renderHook(() => useCurrentUser());

    act(() => result.current.saveUser("Renato Ferreira", "admin"));

    expect(result.current.user).toEqual({
      name: "Renato Ferreira",
      role: "admin",
      initials: "RF",
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.initials).toBe("RF");
  });

  it("saveUser derives initials correctly for single name", () => {
    const { result } = renderHook(() => useCurrentUser());
    act(() => result.current.saveUser("Carlos", "comercial"));
    expect(result.current.user?.initials).toBe("C");
  });

  it("saveUser derives initials for three-word name (first + last only)", () => {
    const { result } = renderHook(() => useCurrentUser());
    act(() => result.current.saveUser("Maria João Silva", "visualizacao"));
    expect(result.current.user?.initials).toBe("MS");
  });

  it("clearUser removes user from state and localStorage", () => {
    const stored: CurrentUser = { name: "Ana Lima", role: "projetista", initials: "AL" };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() => useCurrentUser());
    expect(result.current.user).not.toBeNull();

    act(() => result.current.clearUser());

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

```bash
npm test -- tests/user/use-current-user.test.ts
```

Expected: `FAIL` com "Cannot find module".

- [ ] **Step 3: Implementar o hook**

Criar `web/features/user/hooks/use-current-user.ts`:

```typescript
"use client";

import { useCallback, useState } from "react";

const STORAGE_KEY = "tsteck:current-user";

export type UserRole = "admin" | "projetista" | "comercial" | "visualizacao";

export type CurrentUser = {
  name: string;
  role: UserRole;
  initials: string;
};

function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function readStoredUser(): CurrentUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(readStoredUser);

  const saveUser = useCallback((name: string, role: UserRole) => {
    const newUser: CurrentUser = { name, role, initials: deriveInitials(name) };
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
    }
    setUser(newUser);
  }, []);

  const clearUser = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
    setUser(null);
  }, []);

  return { user, saveUser, clearUser };
}
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

```bash
npm test -- tests/user/use-current-user.test.ts
```

Expected: `PASS` — 6 testes passando.

- [ ] **Step 5: Commit**

```bash
git add features/user/hooks/use-current-user.ts tests/user/use-current-user.test.ts
git commit -m "feat: add useCurrentUser hook with localStorage persistence"
```

---

### Task 4: SidebarNavItem + SidebarNavGroup

**Files:**
- Create: `features/sidebar/components/sidebar-nav-item.tsx`
- Create: `features/sidebar/components/sidebar-nav-group.tsx`

Estes componentes são puramente visuais/de navegação, sem lógica de negócio. Testes são cobridos pela integração da AppSidebar. Não há lógica a testar unitariamente aqui.

- [ ] **Step 1: Criar SidebarNavItem**

Criar `web/features/sidebar/components/sidebar-nav-item.tsx`:

```tsx
"use client";

import Link from "next/link";
import * as Tooltip from "@radix-ui/react-tooltip";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type SidebarNavItemProps = {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  collapsed: boolean;
};

export function SidebarNavItem({ href, label, icon: Icon, isActive, collapsed }: SidebarNavItemProps) {
  const link = (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "border-l-2 border-[#9e0b0f] bg-red-50 text-[#9e0b0f]"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
        collapsed && "justify-center px-0"
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{link}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="right"
            sideOffset={8}
            className="z-50 rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white shadow-md"
          >
            {label}
            <Tooltip.Arrow className="fill-zinc-900" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
```

- [ ] **Step 2: Verificar que `@/lib/utils` exporta `cn`**

Executar:
```powershell
Select-String -Path "lib/utils.ts" -Pattern "export.*cn"
```

Se não existir, criar `web/lib/utils.ts`:
```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Criar SidebarNavGroup**

Criar `web/features/sidebar/components/sidebar-nav-group.tsx`:

```tsx
"use client";

import type { LucideIcon } from "lucide-react";
import { SidebarNavItem } from "./sidebar-nav-item";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type SidebarNavGroupProps = {
  groupLabel: string;
  items: NavItem[];
  activePathname: string;
  collapsed: boolean;
  className?: string;
};

export function SidebarNavGroup({
  groupLabel,
  items,
  activePathname,
  collapsed,
  className,
}: SidebarNavGroupProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      {!collapsed && (
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
          {groupLabel}
        </p>
      )}
      {items.map((item) => (
        <SidebarNavItem
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          isActive={activePathname === item.href || activePathname.startsWith(item.href + "/")}
          collapsed={collapsed}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add features/sidebar/components/sidebar-nav-item.tsx \
        features/sidebar/components/sidebar-nav-group.tsx
git commit -m "feat: add SidebarNavItem and SidebarNavGroup components"
```

---

### Task 5: SidebarBrand + SidebarUserProfile

**Files:**
- Create: `features/sidebar/components/sidebar-brand.tsx`
- Create: `features/sidebar/components/sidebar-user-profile.tsx`

- [ ] **Step 1: Criar SidebarBrand**

Criar `web/features/sidebar/components/sidebar-brand.tsx`:

```tsx
"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type SidebarBrandProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export function SidebarBrand({ collapsed, onToggle }: SidebarBrandProps) {
  return (
    <div
      className={cn(
        "flex items-center border-b border-zinc-200 px-3 py-4",
        collapsed ? "justify-center" : "justify-between"
      )}
    >
      {!collapsed && (
        <div className="flex flex-col leading-tight">
          <span className="font-rajdhani text-base font-700 tracking-widest text-[#9e0b0f]">
            TSTECK
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Projetos
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Criar SidebarUserProfile**

Criar `web/features/sidebar/components/sidebar-user-profile.tsx`:

```tsx
"use client";

import type { CurrentUser } from "@/features/user/hooks/use-current-user";
import { cn } from "@/lib/utils";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  projetista: "Projetista",
  comercial: "Comercial",
  visualizacao: "Visualização",
};

type SidebarUserProfileProps = {
  user: CurrentUser | null;
  collapsed: boolean;
};

export function SidebarUserProfile({ user, collapsed }: SidebarUserProfileProps) {
  if (!user) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-t border-zinc-200 px-3 py-4",
        collapsed && "justify-center"
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#9e0b0f] text-xs font-bold text-white">
        {user.initials}
      </div>
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900">{user.name}</p>
          <p className="truncate text-[11px] text-zinc-500">{ROLE_LABELS[user.role] ?? user.role}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add features/sidebar/components/sidebar-brand.tsx \
        features/sidebar/components/sidebar-user-profile.tsx
git commit -m "feat: add SidebarBrand and SidebarUserProfile components"
```

---

### Task 6: AppSidebar — montagem

**Files:**
- Create: `features/sidebar/components/app-sidebar.tsx`

- [ ] **Step 1: Criar AppSidebar**

Criar `web/features/sidebar/components/app-sidebar.tsx`:

```tsx
"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Kanban,
  BarChart3,
  Bell,
  Building2,
  HardHat,
  Wrench,
  Box,
  UserRound,
  GraduationCap,
  SlidersHorizontal,
  ScrollText,
} from "lucide-react";
import { useSidebar } from "@/features/sidebar/hooks/use-sidebar";
import { useCurrentUser } from "@/features/user/hooks/use-current-user";
import { SidebarBrand } from "./sidebar-brand";
import { SidebarNavGroup, type NavItem } from "./sidebar-nav-group";
import { SidebarNavItem } from "./sidebar-nav-item";
import { SidebarUserProfile } from "./sidebar-user-profile";
import { cn } from "@/lib/utils";

const PROJETOS_ITEMS: NavItem[] = [
  { href: "/", label: "Projetos", icon: LayoutDashboard },
  { href: "/?view=kanban", label: "Kanban", icon: Kanban },
  { href: "/?view=kpis", label: "KPIs", icon: BarChart3 },
  { href: "/?view=alerts", label: "Alertas", icon: Bell },
];

const CADASTROS_ITEMS: NavItem[] = [
  { href: "/master/construtoras", label: "Construtoras", icon: Building2 },
  { href: "/master/obras", label: "Obras", icon: HardHat },
  { href: "/master/equipamentos", label: "Equipamentos", icon: Wrench },
  { href: "/master/tipos-cabine", label: "Tipos de Cabine", icon: Box },
  { href: "/master/vendedores", label: "Vendedores", icon: UserRound },
  { href: "/master/engenheiros", label: "Engenheiros", icon: GraduationCap },
];

const CONFIG_ITEMS: NavItem[] = [
  { href: "/master/preferencias", label: "Preferências", icon: SlidersHorizontal },
  { href: "/master/auditoria", label: "Auditoria", icon: ScrollText },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const { user } = useCurrentUser();

  const showCadastros = user?.role === "admin" || user?.role === "projetista";
  const showConfig = user?.role === "admin";

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col flex-shrink-0 h-screen bg-white border-r border-zinc-200",
        "transition-[width] duration-200 overflow-hidden",
        collapsed ? "w-[64px]" : "w-[240px]"
      )}
      aria-label="Navegação principal"
    >
      <SidebarBrand collapsed={collapsed} onToggle={toggle} />

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-4">
        <SidebarNavGroup
          groupLabel="Pipeline"
          items={PROJETOS_ITEMS}
          activePathname={pathname}
          collapsed={collapsed}
        />

        {showCadastros && (
          <SidebarNavGroup
            groupLabel="Cadastros"
            items={CADASTROS_ITEMS}
            activePathname={pathname}
            collapsed={collapsed}
          />
        )}

        {showConfig && (
          <SidebarNavGroup
            groupLabel="Configurações"
            items={CONFIG_ITEMS}
            activePathname={pathname}
            collapsed={collapsed}
          />
        )}
      </nav>

      <SidebarUserProfile user={user} collapsed={collapsed} />
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add features/sidebar/components/app-sidebar.tsx
git commit -m "feat: add AppSidebar component"
```

---

### Task 7: `app/(main)/layout.tsx` — AppShell

**Files:**
- Create: `app/(main)/layout.tsx`

- [ ] **Step 1: Criar o layout do route group**

Criar `web/app/(main)/layout.tsx`:

```tsx
import { AppSidebar } from "@/features/sidebar/components/app-sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto bg-background">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Iniciar dev server e verificar visualmente**

```bash
npm run dev
```

Abrir `http://localhost:3000`. Verificar:
- Sidebar aparece na esquerda com 240px
- Botão `[←]` no topo da sidebar recolhe para 64px
- Ícone `[→]` expande novamente
- Navegação "/" ativa com highlight vermelho
- Estado de collapse persiste ao recarregar a página

- [ ] **Step 3: Commit**

```bash
git add app/(main)/layout.tsx
git commit -m "feat: add (main) route group layout with AppSidebar"
```

---

### Task 8: `IdentificationModal`

**Files:**
- Create: `features/user/components/identification-modal.tsx`

- [ ] **Step 1: Criar o modal de identificação**

Criar `web/features/user/components/identification-modal.tsx`:

```tsx
"use client";

import { FormEvent, useState } from "react";
import { useCurrentUser, type UserRole } from "@/features/user/hooks/use-current-user";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "projetista", label: "Projetista" },
  { value: "comercial", label: "Comercial" },
  { value: "visualizacao", label: "Visualização" },
];

type IdentificationModalProps = {
  /** Quando true, exibe o botão Cancelar (modo edição em Preferências) */
  allowCancel?: boolean;
  onCancel?: () => void;
};

export function IdentificationModal({ allowCancel = false, onCancel }: IdentificationModalProps) {
  const { saveUser } = useCurrentUser();
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("projetista");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Nome é obrigatório.");
      return;
    }
    setError("");
    saveUser(trimmed, role);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="id-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-white shadow-xl">
        <div className="border-b border-zinc-200 px-6 py-4">
          <h2 id="id-modal-title" className="text-base font-semibold text-zinc-900">
            Identificação
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            Informe seu nome e perfil para continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="id-name" className="text-sm font-medium text-zinc-700">
                Seu nome <span className="text-red-500">*</span>
              </label>
              <input
                id="id-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Renato Ferreira"
                autoComplete="off"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="id-role" className="text-sm font-medium text-zinc-700">
                Perfil
              </label>
              <select
                id="id-role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#9e0b0f] focus:ring-1 focus:ring-[#9e0b0f]"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            {allowCancel && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="rounded-md bg-[#9e0b0f] px-4 py-2 text-sm font-medium text-white hover:bg-[#7a0810]"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Integrar o modal no layout principal**

Editar `web/app/(main)/layout.tsx` para incluir o modal quando `user === null`:

```tsx
"use client";

import { AppSidebar } from "@/features/sidebar/components/app-sidebar";
import { IdentificationModal } from "@/features/user/components/identification-modal";
import { useCurrentUser } from "@/features/user/hooks/use-current-user";

function MainLayoutInner({ children }: { children: React.ReactNode }) {
  const { user } = useCurrentUser();

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <main className="min-w-0 flex-1 overflow-y-auto bg-background">
        {children}
      </main>
      {user === null && <IdentificationModal />}
    </div>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return <MainLayoutInner>{children}</MainLayoutInner>;
}
```

Nota: o layout precisa de `"use client"` porque chama `useCurrentUser` (hook de cliente). Isso é aceitável no App Router — o layout pode ser Client Component.

- [ ] **Step 3: Testar manualmente o modal**

```bash
npm run dev
```

1. Abrir `http://localhost:3000` em aba anônima (localStorage limpo).
2. Verificar que o `IdentificationModal` aparece sobre o conteúdo.
3. Submeter sem nome — verificar mensagem de erro "Nome é obrigatório."
4. Preencher nome + perfil e clicar Salvar.
5. Verificar que o modal desaparece e o avatar com iniciais aparece no rodapé da sidebar.
6. Recarregar a página — modal não deve aparecer novamente.

- [ ] **Step 4: Commit**

```bash
git add features/user/components/identification-modal.tsx app/(main)/layout.tsx
git commit -m "feat: add IdentificationModal and integrate into main layout"
```

---

### Task 9: Stub pages para rotas de master

**Files:**
- Create: `app/(main)/master/construtoras/page.tsx`
- Create: `app/(main)/master/obras/page.tsx`
- Create: `app/(main)/master/equipamentos/page.tsx`
- Create: `app/(main)/master/tipos-cabine/page.tsx`
- Create: `app/(main)/master/vendedores/page.tsx`
- Create: `app/(main)/master/engenheiros/page.tsx`
- Create: `app/(main)/master/auditoria/page.tsx`

- [ ] **Step 1: Criar um componente de stub reutilizável**

Criar `web/features/master-data/components/coming-soon-page.tsx`:

```tsx
import type { LucideIcon } from "lucide-react";

type ComingSoonPageProps = {
  title: string;
  icon: LucideIcon;
};

export function ComingSoonPage({ title, icon: Icon }: ComingSoonPageProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-zinc-400">
      <Icon className="h-12 w-12" />
      <div className="text-center">
        <p className="text-lg font-semibold text-zinc-600">{title}</p>
        <p className="text-sm">Em breve — Fase 2</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Criar todas as stub pages**

Criar `web/app/(main)/master/construtoras/page.tsx`:
```tsx
import { Building2 } from "lucide-react";
import { ComingSoonPage } from "@/features/master-data/components/coming-soon-page";

export default function ConstrutorsPage() {
  return <ComingSoonPage title="Construtoras" icon={Building2} />;
}
```

Criar `web/app/(main)/master/obras/page.tsx`:
```tsx
import { HardHat } from "lucide-react";
import { ComingSoonPage } from "@/features/master-data/components/coming-soon-page";

export default function ObrasPage() {
  return <ComingSoonPage title="Obras" icon={HardHat} />;
}
```

Criar `web/app/(main)/master/equipamentos/page.tsx`:
```tsx
import { Wrench } from "lucide-react";
import { ComingSoonPage } from "@/features/master-data/components/coming-soon-page";

export default function EquipamentosPage() {
  return <ComingSoonPage title="Equipamentos" icon={Wrench} />;
}
```

Criar `web/app/(main)/master/tipos-cabine/page.tsx`:
```tsx
import { Box } from "lucide-react";
import { ComingSoonPage } from "@/features/master-data/components/coming-soon-page";

export default function TiposCabinePage() {
  return <ComingSoonPage title="Tipos de Cabine" icon={Box} />;
}
```

Criar `web/app/(main)/master/vendedores/page.tsx`:
```tsx
import { UserRound } from "lucide-react";
import { ComingSoonPage } from "@/features/master-data/components/coming-soon-page";

export default function VendedoresPage() {
  return <ComingSoonPage title="Vendedores" icon={UserRound} />;
}
```

Criar `web/app/(main)/master/engenheiros/page.tsx`:
```tsx
import { GraduationCap } from "lucide-react";
import { ComingSoonPage } from "@/features/master-data/components/coming-soon-page";

export default function EngenheirosPage() {
  return <ComingSoonPage title="Engenheiros" icon={GraduationCap} />;
}
```

Criar `web/app/(main)/master/auditoria/page.tsx`:
```tsx
import { ScrollText } from "lucide-react";
import { ComingSoonPage } from "@/features/master-data/components/coming-soon-page";

export default function AuditoriaPage() {
  return <ComingSoonPage title="Auditoria" icon={ScrollText} />;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(main)/master/ features/master-data/components/coming-soon-page.tsx
git commit -m "feat: add stub pages for all master data routes"
```

---

### Task 10: Verificação final + suite completa de testes

- [ ] **Step 1: Rodar toda a suite de testes**

```bash
cd web
npm test
```

Expected: todos os testes passando (10 arquivos existentes + 2 novos = 12 arquivos, sem falhas).

- [ ] **Step 2: Verificar lint**

```bash
npm run lint
```

Expected: sem erros.

- [ ] **Step 3: Verificar build**

```bash
npm run build
```

Expected: `✓ Compiled successfully` — sem erros de tipo.

- [ ] **Step 4: Verificação manual no browser**

Checklist:
- [ ] Sidebar visível em `http://localhost:3000` com `w-[240px]`
- [ ] Clicar `[←]` recolhe para `w-[64px]`; ícones aparecem centralizados
- [ ] Hover num ícone recolhido exibe tooltip com o nome (Radix Tooltip)
- [ ] Item "/" ativo com fundo vermelho e borda esquerda
- [ ] Clicar "Construtoras" navega para `/master/construtoras` e exibe "Em breve"
- [ ] Estado collapse persiste após F5
- [ ] Em janela anônima: `IdentificationModal` aparece; após preencher, avatar aparece no rodapé
- [ ] Sidebar responde corretamente a role: `admin` vê Cadastros + Configurações; `comercial` vê apenas Pipeline
- [ ] Em viewport < lg (`< 1024px`): sidebar some (mobile — overlay não implementado nesta fase)

- [ ] **Step 5: Commit final da fase**

```bash
git add .
git commit -m "feat: complete Phase 1 — sidebar shell + user identity"
```

---

## Próxima fase

Após a Fase 1 estar verde, prosseguir com:

📄 `docs/superpowers/plans/2026-05-28-phase2-master-data-layer-plan.md`
