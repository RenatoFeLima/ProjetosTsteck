import { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SellerMultiSelect, type SellerOption } from "@/features/admin/components/seller-multi-select";

const SELLERS: SellerOption[] = [
  { id: "sA", name: "MÔNICA", active: true },
  { id: "sB", name: "CARLOS", active: true },
  { id: "sC", name: "JULIANA", active: true },
  { id: "sE", name: "ÉRICA", active: true },
  { id: "sI", name: "ANTIGO", active: false },
  { id: "sZ", name: "OUTRO INATIVO", active: false },
];

function Harness({ initial = [], linked = [], onChange }: { initial?: string[]; linked?: string[]; onChange?: (ids: string[]) => void }) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <>
      <label htmlFor="sel">Vendedores vinculados</label>
      <SellerMultiSelect
        inputId="sel"
        sellers={SELLERS}
        value={value}
        linkedIds={linked}
        onChange={(ids) => {
          setValue(ids);
          onChange?.(ids);
        }}
      />
    </>
  );
}

const input = () => screen.getByRole("combobox", { name: "Vendedores vinculados" });
const optionNames = () => within(screen.getByRole("listbox")).queryAllByRole("option").map((o) => o.textContent);

afterEach(() => cleanup());

describe("SellerMultiSelect", () => {
  it("abre a lista ao focar e mostra só vendedores ativos, em ordem alfabética", async () => {
    render(<Harness />);
    await userEvent.click(input());
    expect(input()).toHaveAttribute("aria-expanded", "true");
    expect(optionNames()).toEqual(["CARLOS", "ÉRICA", "JULIANA", "MÔNICA"]);
  });

  it("pesquisa sem diferenciar acento/maiúsculas", async () => {
    render(<Harness />);
    await userEvent.type(input(), "erica");
    expect(optionNames()).toEqual(["ÉRICA"]);
    await userEvent.clear(input());
    await userEvent.type(input(), "zzz");
    expect(screen.getByText("Nenhum vendedor encontrado.")).toBeInTheDocument();
  });

  it("seleciona por clique: vira chip e sai da lista", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(input());
    await userEvent.click(screen.getByRole("option", { name: "CARLOS" }));
    expect(onChange).toHaveBeenLastCalledWith(["sB"]);
    expect(screen.getByRole("button", { name: "Remover CARLOS" })).toBeInTheDocument();
    expect(optionNames()).not.toContain("CARLOS");
  });

  it("remove individualmente pelo ×", async () => {
    const onChange = vi.fn();
    render(<Harness initial={["sA", "sB"]} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Remover MÔNICA" }));
    expect(onChange).toHaveBeenLastCalledWith(["sB"]);
    expect(screen.queryByRole("button", { name: "Remover MÔNICA" })).not.toBeInTheDocument();
  });

  it("teclado: Enter escolhe o destacado, ↓/↑ navegam, Backspace com busca vazia remove o último, Esc fecha", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    input().focus(); // abre com o 1º destacado
    await userEvent.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["sB"]); // CARLOS (1º em ordem)
    // Restam ÉRICA, JULIANA, MÔNICA: ↓ ↓ ↑ termina na 2ª (JULIANA).
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(["sB", "sC"]);
    await userEvent.keyboard("{Backspace}");
    expect(onChange).toHaveBeenLastCalledWith(["sB"]);
    await userEvent.keyboard("{Escape}");
    expect(input()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("Enter na busca nunca envia o formulário", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Harness />
      </form>,
    );
    input().focus();
    await userEvent.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("inativo JÁ vinculado aparece como chip '(inativo)'; inativo não vinculado nunca é oferecido", async () => {
    render(<Harness initial={["sI"]} linked={["sI"]} />);
    expect(screen.getByText("ANTIGO (inativo)")).toBeInTheDocument();
    await userEvent.click(input());
    expect(optionNames()).not.toContain("OUTRO INATIVO (inativo)");
    expect(optionNames()).not.toContain("OUTRO INATIVO");
  });

  it("inativo vinculado removido nesta edição pode ser recolocado (continua sendo vínculo existente)", async () => {
    render(<Harness initial={["sI"]} linked={["sI"]} />);
    await userEvent.click(screen.getByRole("button", { name: "Remover ANTIGO" }));
    await userEvent.click(input());
    expect(optionNames()).toContain("ANTIGO (inativo)");
  });

  it("vínculo cujo cadastro ainda não carregou mostra 'Carregando…', nunca o ID cru", () => {
    render(
      <SellerMultiSelect sellers={[]} value={["00000000-0000-4000-8000-000000000001"]} onChange={() => {}} />,
    );
    expect(screen.getByText("Carregando…")).toBeInTheDocument();
    expect(screen.queryByText(/00000000-0000-4000/)).not.toBeInTheDocument();
  });

  it("nomes acessíveis: combobox rotulado, listbox e opções", async () => {
    render(<Harness initial={["sA"]} />);
    await userEvent.click(input());
    expect(input()).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
    expect(screen.getByRole("listbox", { name: "Vendedores disponíveis" })).toBeInTheDocument();
  });
});
