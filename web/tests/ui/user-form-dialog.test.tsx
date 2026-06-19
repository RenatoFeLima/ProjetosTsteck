import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// Evita fetch real ao hidratar cadastros mestres ao abrir o dialog.
vi.mock("@/features/master-data/lib/master-data-hydrate", () => ({
  hydrateMasterDataFromApi: vi.fn().mockResolvedValue(undefined),
}));
// Evita chamadas de API ao salvar.
vi.mock("@/features/admin/lib/users-api", () => ({
  createUser: vi.fn().mockResolvedValue({}),
  updateUser: vi.fn().mockResolvedValue({}),
}));

import { UserFormDialog } from "@/features/admin/components/user-form-dialog";
import { useMasterDataStore } from "@/features/master-data/state/master-data-store";

afterEach(() => {
  cleanup();
  // Limpa o store entre testes.
  useMasterDataStore.setState({ vendedores: [] });
});

describe("UserFormDialog — regressão do loop (React #185) e seletor de vendedor", () => {
  it("renderiza sem loop infinito quando aberto (seletor estável de vendedores)", () => {
    // Se o seletor do store retornasse um array novo a cada render, este render
    // entraria em loop e estouraria. Renderizar sem erro já valida a correção.
    expect(() =>
      render(<UserFormDialog open mode="create" onClose={() => {}} />),
    ).not.toThrow();
    expect(screen.getByText("Novo usuário")).toBeInTheDocument();
  });

  it("ao escolher o perfil Vendedor, mostra o seletor de vendedor vinculado", async () => {
    const user = userEvent.setup();
    useMasterDataStore.setState({
      vendedores: [
        { id: "s1", name: "LUCIANO", active: true } as never,
        { id: "s2", name: "ÉRICA", active: true } as never,
        { id: "s3", name: "INATIVO", active: false } as never,
      ],
    });

    render(<UserFormDialog open mode="create" onClose={() => {}} />);

    // Antes de escolher Vendedor, o seletor de vendedor não existe.
    expect(screen.queryByText("Vendedor vinculado")).not.toBeInTheDocument();

    // Seleciona o perfil "Vendedor" (o select de perfil é o primeiro combobox).
    const perfil = screen.getAllByRole("combobox")[0];
    await user.selectOptions(perfil, "SELLER");

    expect(screen.getByText("Vendedor vinculado")).toBeInTheDocument();
    // Opções: só vendedores ativos (LUCIANO, ÉRICA), não o inativo.
    expect(screen.getByRole("option", { name: "LUCIANO" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "ÉRICA" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "INATIVO" })).not.toBeInTheDocument();
  });
});
