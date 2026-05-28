import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { KanbanStatusChangeDialog } from "@/features/projects/components/kanban-status-change-dialog";

afterEach(() => {
  cleanup();
});

describe("kanban status change dialog", () => {
  it("exige observacao para mover para revisao de estudo", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <KanbanStatusChangeDialog
        open
        projectCode="ABC-123-4567"
        fromStatus="PROJETO APROVADO"
        toStatus="REVISAO DE ESTUDO"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: /Confirmar mudanca/i });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByLabelText(/Observacao obrigatoria/i), " Ajuste tecnico solicitado pelo cliente. ");
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith("Ajuste tecnico solicitado pelo cliente.");
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("permite confirmar sem observacao para outros status", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <KanbanStatusChangeDialog
        open
        projectCode="DEF-111-2222"
        fromStatus="ELABORAR ANTE-PROJETO"
        toStatus="ANTE-PROJETO ENVIADO"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: /Confirmar mudanca/i });
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });
});
