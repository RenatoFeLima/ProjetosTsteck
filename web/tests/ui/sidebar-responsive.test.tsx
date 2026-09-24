import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";

// Shell responsivo (Fase 2): desktop preserva a sidebar atual, tablet usa rail
// compacta + ☰, mobile tira a sidebar do layout e usa o drawer (Base UI Dialog).
// CSS visual é validado em viewport real; aqui só comportamento e acessibilidade.

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({
    session: {
      user: {
        name: "Admin", username: "admin", role: "ADMIN", permissions: getDefaultPermissions("ADMIN"),
        sellerId: null, mustChangePassword: false,
      },
    },
    isLoading: false,
    logout: vi.fn(),
  }),
}));

// Tema fora do escopo deste teste (exige ThemeProvider).
vi.mock("@/features/ui/theme/theme-toggle", () => ({
  ThemeToggle: () => <button type="button" aria-label="Alternar para modo escuro" />,
}));

import MainLayout from "@/app/(main)/layout";
import { useProjectsStore } from "@/features/projects/state/projects-store";

// ── matchMedia controlável: largura atual + eventos "change" ─────────────────
let width = 1280;
const listeners = new Set<() => void>();
function installMatchMedia() {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    return {
      media: query,
      get matches() { return min ? width >= Number(min[1]) : false; },
      onchange: null,
      addEventListener: (_: string, cb: () => void) => listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
      addListener: (cb: () => void) => listeners.add(cb),
      removeListener: (cb: () => void) => listeners.delete(cb),
      dispatchEvent: () => true,
    };
  }) as unknown as typeof window.matchMedia;
}
function resizeTo(next: number) {
  act(() => {
    width = next;
    listeners.forEach((cb) => cb());
  });
}

// Trava de scroll do Base UI. No jsdom (sem CSS.supports) ele usa o caminho que
// marca <html data-base-ui-scroll-locked> e fixa o <body> (position/height/
// overflow). Ao liberar, restaura as propriedades longas; o jsdom não decompõe o
// atalho `overflow`, então ele fica serializado no estilo mesmo liberado — por
// isso a verificação usa o marcador e o `position`, não `style.overflow`.
// (Em navegador real a restauração completa foi validada via viewport.)
const scrollLocked = () =>
  document.documentElement.hasAttribute("data-base-ui-scroll-locked") && document.body.style.position === "relative";

const PREF_KEY = "tsteck:sidebar-collapsed";
const drawer = () => screen.queryByRole("dialog", { name: "Menu de navegação" });
const railAside = () =>
  document.querySelectorAll<HTMLElement>('aside[aria-label="Menu de navegação"]')[0] ?? null;
// Dentro do drawer, `nav a` são os itens de navegação.
const drawerLink = (name: string) =>
  [...drawer()!.querySelectorAll<HTMLAnchorElement>("nav a")].find((a) => a.textContent?.trim() === name)!;

function renderShell(at: number, pref: "true" | "false" = "false") {
  width = at;
  localStorage.setItem(PREF_KEY, pref);
  return render(<MainLayout><p>conteúdo</p></MainLayout>);
}

beforeEach(() => {
  listeners.clear();
  installMatchMedia();
  localStorage.clear();
  useProjectsStore.setState({ activeView: "table" });
});

afterEach(() => {
  cleanup();
  document.body.removeAttribute("style");
  document.documentElement.removeAttribute("style");
});

describe("desktop (≥ 1024px) — sidebar atual preservada", () => {
  it("aberta: 248px, rótulos visíveis e botão Recolher; sem ☰ nem barra mobile", () => {
    renderShell(1280, "false");
    const wrapper = railAside().parentElement!;
    expect(wrapper).toHaveClass("lg:w-[248px]");
    expect(screen.getByRole("button", { name: "Recolher menu" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abrir menu" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Kanban" })).toHaveTextContent("Kanban");
  });

  it("colapsada pela preferência salva: 76px e botão Expandir", () => {
    renderShell(1280, "true");
    expect(railAside().parentElement!).toHaveClass("lg:w-[76px]");
    expect(screen.getByRole("button", { name: "Expandir menu" })).toBeInTheDocument();
  });

  it("navegação por activeView continua igual (Kanban troca a view, sem rota nova)", async () => {
    renderShell(1280);
    await userEvent.click(screen.getByRole("link", { name: "Kanban" }));
    expect(useProjectsStore.getState().activeView).toBe("kanban");
  });
});

describe("tablet (768–1023px) — rail compacta + ☰", () => {
  it("rail compacta sem botão de recolher e com ☰ para o menu completo", () => {
    renderShell(820, "false");
    expect(railAside()).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Recolher menu|Expandir menu/ })).not.toBeInTheDocument();
    const burger = screen.getByRole("button", { name: "Abrir menu" });
    expect(burger).toHaveAttribute("aria-expanded", "false");
  });

  it("itens da rail têm nome acessível sem depender do tooltip", () => {
    renderShell(820);
    for (const name of ["Projetos", "Kanban", "Obras", "Auditoria"]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("aria-label", name);
      expect(link).toHaveTextContent(""); // rótulo não é renderizado na rail
    }
  });

  it("☰ abre o drawer completo, que fecha ao navegar", async () => {
    renderShell(820);
    await userEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    expect(drawer()).toBeInTheDocument();
    await userEvent.click(drawerLink("Alertas"));
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
    expect(useProjectsStore.getState().activeView).toBe("alerts");
  });

  it("abrir/fechar o drawer no tablet não altera a preferência do desktop", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderShell(820, "false");
    setItem.mockClear();
    await userEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    await userEvent.click(screen.getByRole("button", { name: "Fechar menu" }));
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
    resizeTo(1280);
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem(PREF_KEY)).toBe("false");
    expect(railAside().parentElement!).toHaveClass("lg:w-[248px]");
    setItem.mockRestore();
  });
});

describe("mobile (< 768px) — sem sidebar no layout; drawer sobreposto", () => {
  it("não renderiza a sidebar no layout; mostra a barra com ☰", () => {
    renderShell(390);
    expect(railAside()).toBeNull();
    const burger = screen.getByRole("button", { name: "Abrir menu" });
    expect(burger).toHaveAttribute("aria-expanded", "false");
    expect(burger).toHaveAttribute("aria-controls", "app-nav-drawer");
    expect(burger.closest("header")).toHaveClass("md:hidden");
  });

  it("☰ abre o drawer modal; aria-expanded acompanha; foco inicial dentro", async () => {
    renderShell(390);
    const burger = screen.getByRole("button", { name: "Abrir menu" });
    await userEvent.click(burger);
    const dialog = drawer()!;
    expect(dialog).toHaveAttribute("id", "app-nav-drawer");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(burger).toHaveAttribute("aria-expanded", "true");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it("X fecha e devolve o foco ao ☰", async () => {
    renderShell(390);
    const burger = screen.getByRole("button", { name: "Abrir menu" });
    await userEvent.click(burger);
    await userEvent.click(screen.getByRole("button", { name: "Fechar menu" }));
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
    expect(burger).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(document.activeElement).toBe(burger));
  });

  it("ESC fecha e devolve o foco ao ☰", async () => {
    renderShell(390);
    const burger = screen.getByRole("button", { name: "Abrir menu" });
    await userEvent.click(burger);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(burger));
  });

  it("clique no backdrop fecha", async () => {
    renderShell(390);
    await userEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    const backdrop = document.querySelector<HTMLElement>(".bg-black\\/45")!;
    expect(backdrop).not.toBeNull();
    await userEvent.click(backdrop);
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
  });

  it("selecionar item fecha o drawer e mantém a navegação por activeView", async () => {
    renderShell(390);
    await userEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    await userEvent.click(drawerLink("Kanban"));
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
    expect(useProjectsStore.getState().activeView).toBe("kanban");
  });

  it("trava o scroll enquanto aberto e restaura ao fechar", async () => {
    renderShell(390);
    await userEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    await waitFor(() => expect(scrollLocked()).toBe(true));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
    await waitFor(() => expect(scrollLocked()).toBe(false));
    expect(document.body.style.position).toBe("");
  });

  it("drawer aberto nunca é persistido; ao remontar começa fechado", async () => {
    const view = renderShell(390);
    await userEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    expect(drawer()).toBeInTheDocument();
    expect(Object.keys(localStorage)).toEqual([PREF_KEY]);
    view.unmount();
    render(<MainLayout><p>conteúdo</p></MainLayout>);
    expect(drawer()).not.toBeInTheDocument();
  });
});

describe("troca de faixa com o drawer aberto — sem estado fantasma", () => {
  it("mobile → desktop remove drawer/backdrop, destrava o scroll e volta fechado ao mobile", async () => {
    renderShell(390, "true");
    await userEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    await waitFor(() => expect(scrollLocked()).toBe(true));

    resizeTo(1280);
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
    expect(document.querySelector(".bg-black\\/45")).toBeNull();
    await waitFor(() => expect(scrollLocked()).toBe(false));
    expect(screen.queryByRole("button", { name: "Abrir menu" })).not.toBeInTheDocument();
    // Preferência do desktop (colapsada) intacta.
    expect(railAside().parentElement!).toHaveClass("lg:w-[76px]");
    expect(localStorage.getItem(PREF_KEY)).toBe("true");

    resizeTo(390);
    expect(drawer()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("767 ↔ 768 e 1023 → 1024 fecham o drawer aberto", async () => {
    renderShell(767);
    expect(railAside()).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    resizeTo(768);
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
    expect(railAside()).not.toBeNull(); // rail do tablet

    await userEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    resizeTo(767);
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
    expect(railAside()).toBeNull();

    resizeTo(1023);
    await userEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    resizeTo(1024);
    await waitFor(() => expect(drawer()).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Recolher menu" })).toBeInTheDocument();
  });
});
