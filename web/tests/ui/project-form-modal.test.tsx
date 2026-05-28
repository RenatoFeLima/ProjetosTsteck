import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectFormModal } from "@/features/projects/components/project-form-modal";
import type { Project } from "@/features/projects/domain/project-types";

function buildCreateProps() {
  return {
    open: true,
    mode: "create" as const,
    quickMode: false,
    statusHistory: [],
    observations: [],
    onClose: vi.fn(),
    onCreate: vi.fn<(input: Partial<Project>) => { ok: boolean; error?: string; missing?: string[] }>(() => ({ ok: true })),
    onUpdate: vi.fn(() => ({ ok: true })),
    onDelete: vi.fn(),
    onMoveStatus: vi.fn(() => ({ ok: true })),
    isCodigoDuplicado: vi.fn(() => false),
    onAddObservation: vi.fn(),
    notify: vi.fn(),
  };
}

async function selectComboboxOption(
  user: ReturnType<typeof userEvent.setup>,
  ariaLabel: string,
  searchLabel: string,
  value: string,
) {
  const trigger = screen.getAllByRole("button", { name: ariaLabel })[0];
  await user.click(trigger);
  const searchInput = screen.getByRole("combobox", { name: searchLabel });
  await user.clear(searchInput);
  await user.type(searchInput, value);
  await user.click(screen.getByRole("option", { name: new RegExp(value, "i") }));
}

afterEach(() => {
  cleanup();
});

describe("project form modal create flow", () => {
  it("nao abre modal de confirmacao quando campos obrigatorios faltam", async () => {
    const user = userEvent.setup();
    const props = buildCreateProps();

    render(<ProjectFormModal {...props} />);

    await user.click(screen.getByRole("button", { name: /Salvar/i }));

    expect(props.onCreate).not.toHaveBeenCalled();
    expect(screen.queryByText(/Confirmar cadastro do projeto\?/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Campos obrigatorios pendentes/i)).toBeInTheDocument();
    expect(screen.getAllByText("Construtora").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Obra").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Codigo do projeto").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vendedor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Equipamento").length).toBeGreaterThan(0);
    expect(props.notify).toHaveBeenCalled();
  });

  it("abre confirmacao antes de salvar e so salva ao confirmar", async () => {
    const user = userEvent.setup();
    const props = buildCreateProps();

    render(<ProjectFormModal {...props} />);

    await selectComboboxOption(user, "Selecionar construtora", "Buscar construtora...", "ACRY");
    await selectComboboxOption(user, "Selecionar obra", "Buscar obra...", "ARTHUR DE AZEVEDO");
    await selectComboboxOption(user, "Selecionar vendedor", "Buscar vendedor...", "RENATO");
    await selectComboboxOption(user, "Selecionar equipamento", "Buscar equipamento...", "EK-15/26");

    await user.type(screen.getByPlaceholderText(/Codigo \* \(AAA-AAA-AAAA\)/i), "ABC1234567");

    await user.click(screen.getByRole("button", { name: /Salvar/i }));

    expect(props.onCreate).not.toHaveBeenCalled();
    expect(screen.getByText(/Confirmar cadastro do projeto\?/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Status$/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Confirmar e salvar/i }));

    expect(props.onCreate).toHaveBeenCalledTimes(1);
    expect(props.onCreate.mock.calls[0][0]).toMatchObject({
      status_atual: "CADASTRO INICIAL",
      vendedor: "RENATO",
    });
    expect(props.notify).toHaveBeenCalledWith(expect.stringMatching(/Projeto cadastrado com sucesso/i));
    expect(props.onClose).toHaveBeenCalled();
  });

  it("oculta campo de status no cadastro inicial", () => {
    const props = buildCreateProps();

    render(<ProjectFormModal {...props} />);

    expect(screen.queryByLabelText(/Selecionar status do projeto/i)).not.toBeInTheDocument();
  });

  it("forca status inicial mesmo com tentativa de payload adulterado", async () => {
    const user = userEvent.setup();
    const props = buildCreateProps();
    props.onCreate = vi.fn<(input: Partial<Project>) => { ok: boolean; error?: string; missing?: string[] }>((input) => {
      expect(input.status_atual).toBe("CADASTRO INICIAL");
      return { ok: true };
    });

    render(<ProjectFormModal {...props} />);

    await selectComboboxOption(user, "Selecionar construtora", "Buscar construtora...", "ACRY");
    await selectComboboxOption(user, "Selecionar obra", "Buscar obra...", "ARTHUR DE AZEVEDO");
    await selectComboboxOption(user, "Selecionar vendedor", "Buscar vendedor...", "RENATO");
    await selectComboboxOption(user, "Selecionar equipamento", "Buscar equipamento...", "EK-20/30");

    await user.type(screen.getByPlaceholderText(/Codigo \* \(AAA-AAA-AAAA\)/i), "ZZZ1234567");

    await user.click(screen.getByRole("button", { name: /Salvar/i }));
    await user.click(screen.getByRole("button", { name: /Confirmar e salvar/i }));

    expect(props.onCreate).toHaveBeenCalledTimes(1);
  });
});
