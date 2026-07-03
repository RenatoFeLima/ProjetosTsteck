import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReminderAlertDialog } from "@/features/projects/components/reminder-alert-dialog";
import { postponeQuickDates } from "@/features/projects/components/reminder-badges";
import type { ProjectReminder } from "@/features/projects/domain/project-reminders";
import { todayIsoDate } from "@/features/projects/domain/project-rules";
import type { Project } from "@/features/projects/domain/project-types";

const project = {
  id: "p1",
  codigo_projeto: "CRE-UBA-2060",
  construtora: "ACRY",
  obra: "ARTHUR DE AZEVEDO",
} as Project;

function makeReminder(overrides: Partial<ProjectReminder> = {}): ProjectReminder {
  return {
    id: "r1",
    projeto_id: "p1",
    descricao: "Validar com o vendedor a quantidade de itens locados nessa obra.",
    prioridade: "ALTA",
    status: "PENDENTE",
    data_inicial: "2026-06-01",
    proxima_data: "2026-06-01",
    recorrencia_dias: 7,
    criado_por: "Renato",
    criado_em: "2026-06-01T10:00:00.000Z",
    atualizado_em: "2026-06-01T10:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("ReminderAlertDialog — alerta estilo Outlook", () => {
  it("11. mostra projeto, obra/construtora, descrição, prioridade e dias vencidos", () => {
    render(
      <ReminderAlertDialog
        open
        reminders={[makeReminder()]}
        projects={[project]}
        canManage
        onClose={() => {}}
        onOpenProject={() => {}}
        onPostpone={() => {}}
        onResolve={() => {}}
      />,
    );
    expect(screen.getByText("Lembretes pendentes")).toBeInTheDocument();
    expect(screen.getByText("CRE-UBA-2060")).toBeInTheDocument();
    expect(screen.getByText(/ACRY — ARTHUR DE AZEVEDO/)).toBeInTheDocument();
    expect(screen.getByText(/Validar com o vendedor/)).toBeInTheDocument();
    expect(screen.getByText(/^Alta$/)).toBeInTheDocument();
    expect(screen.getByText(/dias vencidos/)).toBeInTheDocument();
  });

  it("12/13. 'Adiar → Em 7 dias' chama onPostpone com a data correta", async () => {
    const user = userEvent.setup();
    const onPostpone = vi.fn();
    render(
      <ReminderAlertDialog
        open
        reminders={[makeReminder()]}
        projects={[project]}
        canManage
        onClose={() => {}}
        onOpenProject={() => {}}
        onPostpone={onPostpone}
        onResolve={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^Adiar$/i }));
    await user.click(screen.getByRole("menuitem", { name: /Em 7 dias/i }));

    expect(onPostpone).toHaveBeenCalledWith("r1", postponeQuickDates(todayIsoDate()).seteDias);
  });

  it("14. 'Marcar como resolvido' chama onResolve", async () => {
    const user = userEvent.setup();
    const onResolve = vi.fn();
    render(
      <ReminderAlertDialog
        open
        reminders={[makeReminder()]}
        projects={[project]}
        canManage
        onClose={() => {}}
        onOpenProject={() => {}}
        onPostpone={() => {}}
        onResolve={onResolve}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Marcar como resolvido/i }));
    expect(onResolve).toHaveBeenCalledWith("r1");
  });

  it("'Abrir projeto' chama onOpenProject com o projeto", async () => {
    const user = userEvent.setup();
    const onOpenProject = vi.fn();
    render(
      <ReminderAlertDialog
        open
        reminders={[makeReminder()]}
        projects={[project]}
        canManage
        onClose={() => {}}
        onOpenProject={onOpenProject}
        onPostpone={() => {}}
        onResolve={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Abrir projeto/i }));
    expect(onOpenProject).toHaveBeenCalledWith(project);
  });

  it("3. sem permissão de gerenciar, não mostra Adiar/Resolver (somente leitura)", () => {
    render(
      <ReminderAlertDialog
        open
        reminders={[makeReminder()]}
        projects={[project]}
        canManage={false}
        onClose={() => {}}
        onOpenProject={() => {}}
        onPostpone={() => {}}
        onResolve={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: /^Adiar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Marcar como resolvido/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Abrir projeto/i })).toBeInTheDocument();
  });

  it("15. sem lembretes pendentes, não renderiza nada", () => {
    const { container } = render(
      <ReminderAlertDialog
        open
        reminders={[]}
        projects={[project]}
        canManage
        onClose={() => {}}
        onOpenProject={() => {}}
        onPostpone={() => {}}
        onResolve={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
