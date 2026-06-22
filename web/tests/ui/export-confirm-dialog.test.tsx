import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportConfirmDialog } from "@/features/projects/components/export-confirm-dialog";

afterEach(() => cleanup());

describe("ExportConfirmDialog", () => {
  it("não renderiza quando open=false", () => {
    render(<ExportConfirmDialog open={false} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renderiza título, mensagem e botões quando open", () => {
    render(<ExportConfirmDialog open onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Confirmar exportação/i)).toBeInTheDocument();
    expect(screen.getByText(/informações comerciais e operacionais sensíveis/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancelar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Exportar CSV/i })).toBeInTheDocument();
  });

  it("6. Cancelar chama onCancel e NÃO chama onConfirm", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ExportConfirmDialog open onCancel={onCancel} onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("7. Exportar CSV chama onConfirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ExportConfirmDialog open onCancel={vi.fn()} onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: /Exportar CSV/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("8. durante exportação mostra loading e desabilita os botões (anti duplo clique)", () => {
    render(<ExportConfirmDialog open exporting onCancel={vi.fn()} onConfirm={vi.fn()} />);
    const confirmBtn = screen.getByRole("button", { name: /Gerando exportação/i });
    expect(confirmBtn).toBeDisabled();
    expect(screen.getByRole("button", { name: /Cancelar/i })).toBeDisabled();
  });

  it("não dispara onConfirm com duplo clique enquanto exporting", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ExportConfirmDialog open exporting onCancel={vi.fn()} onConfirm={onConfirm} />);
    // Botão desabilitado: cliques não acionam o handler.
    await user.click(screen.getByRole("button", { name: /Gerando exportação/i }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
