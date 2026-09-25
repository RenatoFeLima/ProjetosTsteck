import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { User, UserPermissions } from "@/features/auth/lib/auth-types";

// Fase 5: Usuários em cards no celular (< 768px). Mesma lista filtrada, mesmos
// handlers e — ponto crítico — o MESMO menu com os MESMOS props de permissão da
// linha da tabela: o card nunca oferece ação que a tabela não ofereceria.

vi.mock("@/features/master-data/lib/master-data-hydrate", () => ({ hydrateMasterDataFromApi: vi.fn(async () => {}) }));
vi.mock("@/features/admin/lib/users-api", () => ({
  fetchUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(async () => ({})),
  resetPassword: vi.fn(async () => {}),
  setActive: vi.fn(async () => ({})),
  setRole: vi.fn(async () => ({})),
}));

// Sessão configurável por teste.
const session: { user: { id: string; name: string; role: string; permissions: UserPermissions } } = {
  user: { id: "me", name: "Admin Local", role: "ADMIN", permissions: getDefaultPermissions("ADMIN") },
};
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ session, isLoading: false, refreshSession: vi.fn() }),
}));

import * as usersApi from "@/features/admin/lib/users-api";
import { UsersPage } from "@/features/admin/components/users-page";

// ── matchMedia controlável (mesmo padrão das fases anteriores) ───────────────
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

function makeUser(over: Partial<User>): User {
  return {
    id: "u", username: "user", name: "Usuário", email: undefined, passwordHash: "", role: "VIEWER", active: true,
    mustChangePassword: false, permissions: getDefaultPermissions("VIEWER"), createdAt: "2026-01-01", updatedAt: "2026-01-01",
    ...over,
  } as User;
}
const ME = makeUser({ id: "me", username: "admin.local", name: "Admin Local", email: "admin@empresa.com.br", role: "ADMIN", lastLoginAt: "2026-09-24T14:36:00" });
const ANA = makeUser({ id: "ana", username: "ana.souza", name: "ANA SOUZA", email: "ana@empresa.com.br", role: "PROJECTS", mustChangePassword: true });
const BIA = makeUser({ id: "bia", username: "bia", name: "BIA LIMA", role: "CUSTOM", active: false });
const OUTRO_ADMIN = makeUser({ id: "adm2", username: "carlos", name: "CARLOS ADMIN", role: "ADMIN" });
const USERS = [ME, ANA, BIA, OUTRO_ADMIN];

beforeEach(() => {
  listeners.clear();
  installMatchMedia();
  vi.mocked(usersApi.fetchUsers).mockReset().mockResolvedValue(USERS);
  vi.mocked(usersApi.setActive).mockClear();
  vi.mocked(usersApi.setRole).mockClear();
  vi.mocked(usersApi.updateUser).mockClear();
  session.user = { id: "me", name: "Admin Local", role: "ADMIN", permissions: getDefaultPermissions("ADMIN") };
});
afterEach(() => cleanup());

async function renderAt(at: number) {
  width = at;
  render(<UsersPage />);
  await waitFor(() => expect(screen.queryByText("Carregando usuários…")).not.toBeInTheDocument());
}
const cardNames = () => within(screen.getByRole("list", { name: "Usuários" })).getAllByRole("heading").map((h) => h.firstChild?.textContent);
const cardOf = (name: string) => screen.getAllByRole("listitem").find((li) => within(li).queryByRole("heading", { name: new RegExp(name) }))!;
const rowOf = (name: string) => screen.getAllByRole("row").find((r) => r.textContent?.includes(name))!;
async function menuItemsIn(scope: HTMLElement) {
  const trigger = within(scope).queryByRole("button", { name: "Ações do usuário" });
  if (!trigger) return null;
  await userEvent.click(trigger);
  const items = (await screen.findAllByRole("menuitem")).map((i) => i.textContent?.trim());
  await userEvent.keyboard("{Escape}");
  return items;
}

describe("apresentação por faixa de tela", () => {
  it.each([390, 430, 767])("%ipx: cards, sem tabela", async (at) => {
    await renderAt(at);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(cardNames()).toEqual(["Admin Local", "ANA SOUZA", "BIA LIMA", "CARLOS ADMIN"]);
  });

  it.each([768, 820, 1024, 1366, 1920])("%ipx: tabela, sem cards", async (at) => {
    await renderAt(at);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Usuários" })).not.toBeInTheDocument();
  });

  it("767 → 768 → 767: mesma lista e ordem, filtros preservados, sem nova chamada", async () => {
    await renderAt(767);
    await userEvent.type(screen.getByPlaceholderText("Buscar por nome, usuário ou e-mail…"), "a");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[1], "active");
    const names = cardNames();
    const calls = vi.mocked(usersApi.fetchUsers).mock.calls.length;
    resizeTo(768);
    const rows = screen.getAllByRole("row").slice(1).map((r) => r.textContent ?? "");
    expect(rows).toHaveLength(names.length);
    names.forEach((n, i) => expect(rows[i]).toContain(n!));
    expect(screen.getByPlaceholderText("Buscar por nome, usuário ou e-mail…")).toHaveValue("a");
    expect(screen.getAllByRole("combobox")[1]).toHaveValue("active");
    resizeTo(767);
    expect(cardNames()).toEqual(names);
    expect(vi.mocked(usersApi.fetchUsers).mock.calls.length).toBe(calls);
  });
});

describe("conteúdo do card", () => {
  it("ativo, você, troca pendente, Personalizado, inativo e último acesso", async () => {
    await renderAt(390);
    const me = cardOf("Admin Local");
    expect(within(me).getByText("você")).toBeInTheDocument();
    expect(within(me).getByText("@admin.local")).toBeInTheDocument();
    expect(within(me).getByText("admin@empresa.com.br")).toHaveClass("truncate");
    expect(within(me).getByText("Administrador")).toBeInTheDocument();
    expect(within(me).getByText("Ativo")).toBeInTheDocument();
    expect(within(me).getByText(/Último acesso:/)).toHaveTextContent("Último acesso: 24/09/2026 14:36");
    expect(within(cardOf("ANA SOUZA")).getByText("Troca pendente")).toBeInTheDocument();
    const bia = cardOf("BIA LIMA");
    expect(within(bia).getByText("Personalizado")).toBeInTheDocument();
    expect(within(bia).getByText("Inativo")).toBeInTheDocument();
    expect(within(bia).getByText("Nunca")).toBeInTheDocument();
    expect(bia.querySelector("article")).toHaveClass("opacity-60");
  });

  it("⋯ do card com alvo de 44px; card não clicável (só o ⋯ é interativo)", async () => {
    await renderAt(390);
    const card = cardOf("ANA SOUZA");
    const buttons = within(card).getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName("Ações do usuário");
    expect(buttons[0]).toHaveClass("h-11", "w-11");
  });
});

describe("busca, filtros e estados atuais", () => {
  it("busca por nome, usuário e e-mail", async () => {
    await renderAt(390);
    const search = screen.getByPlaceholderText("Buscar por nome, usuário ou e-mail…");
    await userEvent.type(search, "carlos");
    expect(cardNames()).toEqual(["CARLOS ADMIN"]);
    await userEvent.clear(search);
    await userEvent.type(search, "ana@empresa");
    expect(cardNames()).toEqual(["ANA SOUZA"]);
  });

  it("filtros de perfil e de status", async () => {
    await renderAt(390);
    const [perfil, status] = screen.getAllByRole("combobox");
    await userEvent.selectOptions(perfil, "ADMIN");
    expect(cardNames()).toEqual(["Admin Local", "CARLOS ADMIN"]);
    await userEvent.selectOptions(perfil, "ALL");
    await userEvent.selectOptions(status, "inactive");
    expect(cardNames()).toEqual(["BIA LIMA"]);
  });

  it("loading: mesmo spinner atual", async () => {
    width = 390;
    vi.mocked(usersApi.fetchUsers).mockImplementation(() => new Promise(() => {}));
    render(<UsersPage />);
    expect(screen.getByText("Carregando usuários…")).toBeInTheDocument();
  });

  it("erro + 'Tentar novamente' faz nova chamada real", async () => {
    width = 390;
    vi.mocked(usersApi.fetchUsers).mockRejectedValueOnce(new Error("Falha de rede."));
    render(<UsersPage />);
    expect(await screen.findByText("Falha de rede.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(cardNames()).toHaveLength(4));
    expect(usersApi.fetchUsers).toHaveBeenCalledTimes(2);
  });

  it("vazio: mesma mensagem atual", async () => {
    vi.mocked(usersApi.fetchUsers).mockResolvedValue([]);
    await renderAt(390);
    expect(screen.getByText("Nenhum usuário encontrado.")).toBeInTheDocument();
  });
});

describe("ações do card (mesmos handlers da tabela)", () => {
  async function clickItem(name: string, label: string) {
    await userEvent.click(within(cardOf(name)).getByRole("button", { name: "Ações do usuário" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: label }));
  }

  it("Editar e Redefinir senha abrem os mesmos diálogos", async () => {
    await renderAt(390);
    await clickItem("ANA SOUZA", "Editar");
    expect(await screen.findByRole("dialog", { name: /editar/i })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    cleanup();
    await renderAt(390);
    await clickItem("ANA SOUZA", "Redefinir senha");
    expect(await screen.findByRole("dialog", { name: "Redefinir senha" })).toBeInTheDocument();
  });

  it("Exigir troca, Tornar/Remover administrador, Inativar e Ativar chamam a mesma API", async () => {
    await renderAt(390);
    await clickItem("ANA SOUZA", "Exigir troca de senha");
    await waitFor(() => expect(usersApi.updateUser).toHaveBeenCalledWith("ana", { mustChangePassword: true }));
    await clickItem("ANA SOUZA", "Tornar administrador");
    await waitFor(() => expect(usersApi.setRole).toHaveBeenCalledWith("ana", "promote"));
    await clickItem("CARLOS ADMIN", "Remover administrador");
    await waitFor(() => expect(usersApi.setRole).toHaveBeenCalledWith("adm2", "revoke"));
    await clickItem("ANA SOUZA", "Inativar");
    await waitFor(() => expect(usersApi.setActive).toHaveBeenCalledWith("ana", false));
    await clickItem("BIA LIMA", "Ativar");
    await waitFor(() => expect(usersApi.setActive).toHaveBeenCalledWith("bia", true));
  });
});

describe("permissões — paridade total card × tabela", () => {
  async function itemsFor(name: string) {
    await renderAt(390);
    const card = await menuItemsIn(cardOf(name));
    resizeTo(1280);
    const row = await menuItemsIn(rowOf(name));
    return { card, row };
  }

  it("ADMIN: mesmos itens; o próprio usuário não pode se inativar nem se rebaixar", async () => {
    const me = await itemsFor("Admin Local");
    expect(me.card).toEqual(me.row);
    expect(me.card).not.toContain("Inativar");
    expect(me.card).not.toContain("Remover administrador");
    cleanup();
    const other = await itemsFor("CARLOS ADMIN");
    expect(other.card).toEqual(other.row);
    expect(other.card).toEqual(expect.arrayContaining(["Remover administrador", "Inativar"]));
  });

  // Cópia profunda: getDefaultPermissions devolve objeto compartilhado do módulo.
  function limitedPerms(users: Partial<UserPermissions["users"]>): UserPermissions {
    const perms = structuredClone(getDefaultPermissions("VIEWER"));
    perms.users = {
      view: true, create: false, edit: false, delete: false, resetPassword: false, managePermissions: false, promoteAdmin: false,
      ...users,
    };
    return perms;
  }

  it("permissão limitada (só redefinir senha): card mostra só o que a tabela mostra", async () => {
    session.user = { id: "me", name: "Admin Local", role: "CUSTOM", permissions: limitedPerms({ resetPassword: true }) };
    const r = await itemsFor("ANA SOUZA");
    expect(r.card).toEqual(["Redefinir senha"]);
    expect(r.card).toEqual(r.row);
  });

  it("sem nenhuma ação: nem card nem tabela oferecem o menu", async () => {
    session.user = { id: "me", name: "Admin Local", role: "CUSTOM", permissions: limitedPerms({}) };
    await renderAt(390);
    expect(within(cardOf("ANA SOUZA")).queryByRole("button", { name: "Ações do usuário" })).toBeNull();
    expect(within(cardOf("ANA SOUZA")).getByText("—")).toBeInTheDocument();
    resizeTo(1280);
    expect(within(rowOf("ANA SOUZA")).queryByRole("button", { name: "Ações do usuário" })).toBeNull();
  });
});

describe("tabela ≥ 768px preservada", () => {
  it("mesmas colunas, badges e menu da linha", async () => {
    await renderAt(1280);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(
      ["Nome", "Usuário", "E-mail", "Perfil", "Status", "Último acesso", ""],
    );
    const row = rowOf("ANA SOUZA");
    expect(within(row).getByText("@ana.souza")).toBeInTheDocument();
    expect(within(row).getByText("Troca pendente")).toBeInTheDocument();
    expect(within(row).getByText("Projetos")).toHaveClass("rounded-md", "border", "px-2.5", "py-1", "text-[11px]", "font-semibold");
    const trigger = within(row).getByRole("button", { name: "Ações do usuário" });
    expect(trigger).toHaveClass("rounded-lg", "p-1.5");
    expect(trigger).not.toHaveClass("h-11");
    expect(rowOf("BIA LIMA")).toHaveClass("opacity-60");
  });
});
