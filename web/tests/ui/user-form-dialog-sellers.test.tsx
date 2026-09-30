import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { User } from "@/features/auth/lib/auth-types";

vi.mock("@/features/master-data/lib/master-data-hydrate", () => ({ hydrateMasterDataFromApi: vi.fn().mockResolvedValue(undefined) }));
const api = vi.hoisted(() => ({ createUser: vi.fn(), updateUser: vi.fn() }));
vi.mock("@/features/admin/lib/users-api", () => api);

import { UserFormDialog } from "@/features/admin/components/user-form-dialog";
import { useMasterDataStore } from "@/features/master-data/state/master-data-store";

const sellersField = () => screen.getByRole("combobox", { name: /Vendedores vinculados/ });
async function pick(name: string) {
  await userEvent.click(sellersField());
  await userEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name }));
}

function sellerUser(over: Partial<User> = {}): User {
  return {
    id: "u1", username: "joao", name: "João", email: "joao@x.com", passwordHash: "", role: "SELLER", active: true,
    mustChangePassword: false, permissions: getDefaultPermissions("SELLER"), sellerIds: ["sA", "sI"], createdAt: "", updatedAt: "", ...over,
  };
}

beforeEach(() => {
  api.createUser.mockReset().mockResolvedValue({});
  api.updateUser.mockReset().mockResolvedValue({});
  useMasterDataStore.setState({
    vendedores: [
      { id: "sA", name: "MÔNICA", active: true },
      { id: "sB", name: "CARLOS", active: true },
      { id: "sI", name: "ANTIGO", active: false },
    ] as never,
  });
});
afterEach(() => cleanup());

describe("Novo usuário — perfil Vendedor", () => {
  async function fillBasics() {
    await userEvent.type(screen.getByPlaceholderText(/João da Silva|Nome/i), "Maria");
    const inputs = screen.getAllByRole("textbox");
    // usuário = 2º campo de texto do formulário
    await userEvent.type(inputs[1], "maria");
    const pwd = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
    await userEvent.type(pwd[0], "segredo1");
    await userEvent.type(pwd[1], "segredo1");
    await userEvent.selectOptions(screen.getAllByRole("combobox")[0], "SELLER");
  }

  it("exige pelo menos um vendedor (não chama a API)", async () => {
    render(<UserFormDialog open mode="create" onClose={() => {}} />);
    await fillBasics();
    await userEvent.click(screen.getByRole("button", { name: /Criar usuário|Salvar/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Selecione pelo menos um vendedor para o perfil Vendedor.");
    expect(api.createUser).not.toHaveBeenCalled();
  });

  it("envia sellerIds (lista) e nunca o campo legado sellerId", async () => {
    render(<UserFormDialog open mode="create" onClose={() => {}} />);
    await fillBasics();
    await pick("MÔNICA");
    await pick("CARLOS");
    await userEvent.click(screen.getByRole("button", { name: /Criar usuário|Salvar/ }));
    await waitFor(() => expect(api.createUser).toHaveBeenCalledTimes(1));
    const payload = api.createUser.mock.calls[0][0];
    expect(payload.sellerIds).toEqual(["sA", "sB"]);
    expect(payload).not.toHaveProperty("sellerId");
  });

  it("mostra o texto de ajuda do conjunto", async () => {
    render(<UserFormDialog open mode="create" onClose={() => {}} />);
    await userEvent.selectOptions(screen.getAllByRole("combobox")[0], "SELLER");
    expect(screen.getByText("O usuário enxergará os projetos vinculados a qualquer um dos vendedores selecionados.")).toBeInTheDocument();
  });
});

describe("Editar usuário", () => {
  it("carrega os vínculos atuais como chips, inclusive o inativo já vinculado", () => {
    render(<UserFormDialog open mode="edit" user={sellerUser()} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: "Remover MÔNICA" })).toBeInTheDocument();
    expect(screen.getByText("ANTIGO (inativo)")).toBeInTheDocument();
  });

  it("salvar sem mexer mantém o inativo já vinculado no payload (edição não trava)", async () => {
    render(<UserFormDialog open mode="edit" user={sellerUser()} onClose={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    await waitFor(() => expect(api.updateUser).toHaveBeenCalledTimes(1));
    expect(api.updateUser.mock.calls[0][1].sellerIds).toEqual(["sA", "sI"]);
  });

  it("remover um vendedor e adicionar outro envia o conjunto novo completo", async () => {
    render(<UserFormDialog open mode="edit" user={sellerUser({ sellerIds: ["sA"] })} onClose={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Remover MÔNICA" }));
    await pick("CARLOS");
    await userEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    await waitFor(() => expect(api.updateUser).toHaveBeenCalledTimes(1));
    expect(api.updateUser.mock.calls[0][1].sellerIds).toEqual(["sB"]);
  });

  it("trocar Vendedor → outro perfil avisa que os vínculos serão removidos e envia []", async () => {
    render(<UserFormDialog open mode="edit" user={sellerUser()} onClose={() => {}} />);
    await userEvent.selectOptions(screen.getAllByRole("combobox")[0], "PROJECTS");
    expect(screen.getByRole("status")).toHaveTextContent("os vínculos com vendedores serão removidos");
    expect(screen.queryByRole("combobox", { name: /Vendedores vinculados/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Salvar/ }));
    await waitFor(() => expect(api.updateUser).toHaveBeenCalledTimes(1));
    expect(api.updateUser.mock.calls[0][1]).toMatchObject({ role: "PROJECTS", sellerIds: [] });
  });

  it("perfil não-Vendedor não mostra o campo", () => {
    render(<UserFormDialog open mode="edit" user={sellerUser({ role: "PROJECTS", sellerIds: [] })} onClose={() => {}} />);
    expect(screen.queryByText(/Vendedores vinculados/)).not.toBeInTheDocument();
  });
});
