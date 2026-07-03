import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReminderFormDialog } from "@/features/projects/components/reminder-form-dialog";
import type { Project } from "@/features/projects/domain/project-types";

const project = {
  id: "p1",
  codigo_projeto: "CRE-UBA-2060",
  construtora: "ACRY",
  obra: "ARTHUR DE AZEVEDO",
} as Project;

afterEach(() => cleanup());

function setup(onSave = vi.fn(async () => ({ ok: true }))) {
  const onCancel = vi.fn();
  render(<ReminderFormDialog open project={project} onCancel={onCancel} onSave={onSave} />);
  return { onSave, onCancel };
}

describe("ReminderFormDialog — criar lembrete para esta obra", () => {
  it("mostra título, contexto da obra e placeholder de exemplo", () => {
    setup();
    expect(screen.getByText("Criar lembrete para esta obra")).toBeInTheDocument();
    expect(screen.getByText(/CRE-UBA-2060/)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/validar com o vendedor a quantidade de itens locados/i),
    ).toBeInTheDocument();
  });

  it("valida descrição obrigatória sem chamar onSave", async () => {
    const user = userEvent.setup();
    const { onSave } = setup();

    await user.click(screen.getByRole("button", { name: /Salvar lembrete/i }));

    expect(await screen.findByText(/Descrição do lembrete é obrigatória/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("valida recorrência positiva", async () => {
    const user = userEvent.setup();
    const { onSave } = setup();

    await user.type(screen.getByLabelText(/Descrição do lembrete/i), "Agendar reunião técnica");
    const recorrencia = screen.getByLabelText(/Repetir a cada/i);
    await user.clear(recorrencia);
    await user.type(recorrencia, "0");
    await user.click(screen.getByRole("button", { name: /Salvar lembrete/i }));

    expect(await screen.findByText(/Recorrência deve ser um número de dias positivo/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("submete valores válidos (descrição, prioridade, data, recorrência)", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({ ok: true }));
    setup(onSave);

    await user.type(
      screen.getByLabelText(/Descrição do lembrete/i),
      "Confirmar com o cliente se precisará de item especial.",
    );
    await user.selectOptions(screen.getByLabelText(/Prioridade/i), "ALTA");
    const data = screen.getByLabelText(/Primeiro alerta/i);
    await user.clear(data);
    // fireEvent-style: input date aceita value direto via type
    await user.type(data, "2026-07-15");
    const recorrencia = screen.getByLabelText(/Repetir a cada/i);
    await user.clear(recorrencia);
    await user.type(recorrencia, "5");

    await user.click(screen.getByRole("button", { name: /Salvar lembrete/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({
      descricao: "Confirmar com o cliente se precisará de item especial.",
      prioridade: "ALTA",
      data_inicial: "2026-07-15",
      recorrencia_dias: 5,
    });
  });

  it("exibe erro do servidor quando onSave falha", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => ({ ok: false, error: "Somente a equipe de Projetos pode gerenciar lembretes." }));
    setup(onSave);

    await user.type(screen.getByLabelText(/Descrição do lembrete/i), "Teste");
    await user.click(screen.getByRole("button", { name: /Salvar lembrete/i }));

    expect(await screen.findByText(/Somente a equipe de Projetos/i)).toBeInTheDocument();
  });

  it("mostra os rótulos ajustados (Primeiro alerta, Repetir a cada + sufixo 'dias') e o texto de apoio", () => {
    setup();
    expect(screen.getByLabelText(/Primeiro alerta/i)).toBeInTheDocument();
    // Label encurtado (evita quebra do asterisco); "dias" é sufixo visual do input.
    expect(screen.getByLabelText(/Repetir a cada/i)).toBeInTheDocument();
    expect(screen.getByText(/^dias$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/será alertada no primeiro alerta e novamente a cada X dias/i),
    ).toBeInTheDocument();
  });

  it("limita a descrição a 500 caracteres (contador + maxLength no textarea)", () => {
    setup();
    const textarea = screen.getByLabelText(/Descrição do lembrete/i) as HTMLTextAreaElement;
    expect(textarea.maxLength).toBe(500);
    expect(screen.getByText(/^0\/500$/)).toBeInTheDocument();
  });
});
