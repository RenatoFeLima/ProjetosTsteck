import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProjectsKanban } from "@/features/projects/components/projects-kanban";
import { useProjectsStore } from "@/features/projects/state/projects-store";
import type { Project } from "@/features/projects/domain/project-types";
import type { ProjectReminder } from "@/features/projects/domain/project-reminders";
import { todayIsoDate } from "@/features/projects/domain/project-rules";
import { addDays, formatISO, parseISO } from "date-fns";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    construtora: "ACRY",
    obra: "OBRA",
    engenheiro_nome: "",
    engenheiro_celular: "",
    equipamento: "EK-15/26",
    tipo_cabine: "",
    codigo_projeto: "COD-000-0001",
    vendedor: "RENATO",
    proj_obra_recebido: true,
    local_cabine_definido: true,
    alinhamento: true,
    data_lancamento: "2026-05-01",
    data_alinhamento: "2026-05-05",
    status_atual: "ELABORAR ANTE-PROJETO",
    status_entered_at: "2026-05-05",
    data_previsao: null,
    data_envio: null,
    data_aprovacao: null,
    urgente: false,
    reviewCount: 0,
    reviewHistory: [],
    finalReviewCount: 0,
    finalReviewHistory: [],
    created_at: "2026-05-01",
    updated_at: "2026-05-10",
    ...overrides,
  };
}

function makeReminder(overrides: Partial<ProjectReminder> = {}): ProjectReminder {
  return {
    id: "r1",
    projeto_id: "p1",
    descricao: "Validar com o vendedor a quantidade de itens locados nessa obra.",
    prioridade: "NORMAL",
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

const noopProps = {
  onMoveStatus: () => ({ ok: true }),
  onOpen: () => {},
  notify: () => {},
  isCodigoDuplicado: () => false,
};

const today = todayIsoDate();
const futureDate = formatISO(addDays(parseISO(today), 5), { representation: "date" });

beforeEach(() => {
  useProjectsStore.setState({ reminders: [] });
});
afterEach(() => {
  cleanup();
  useProjectsStore.setState({ reminders: [] });
});

describe("Kanban — indicador de lembrete no card", () => {
  it("4/7. projeto com lembrete vencido mostra 'Lembrete vencido' no card", () => {
    useProjectsStore.setState({ reminders: [makeReminder({ proxima_data: "2026-06-01" })] });
    render(<ProjectsKanban projects={[makeProject()]} {...noopProps} />);
    expect(screen.getByText(/Lembrete vencido/i)).toBeInTheDocument();
  });

  it("8. lembrete do dia aparece como 'Lembrete hoje'", () => {
    useProjectsStore.setState({ reminders: [makeReminder({ proxima_data: today })] });
    render(<ProjectsKanban projects={[makeProject()]} {...noopProps} />);
    expect(screen.getByText(/Lembrete hoje/i)).toBeInTheDocument();
  });

  it("9. lembrete futuro aparece com dias restantes", () => {
    useProjectsStore.setState({ reminders: [makeReminder({ proxima_data: futureDate })] });
    render(<ProjectsKanban projects={[makeProject()]} {...noopProps} />);
    expect(screen.getByText(/Lembrete em 5d/i)).toBeInTheDocument();
  });

  it("5. múltiplos lembretes: mostra o MAIS CRÍTICO + contador '+N'", () => {
    useProjectsStore.setState({
      reminders: [
        makeReminder({ id: "futuro", proxima_data: futureDate, prioridade: "ALTA" }),
        makeReminder({ id: "vencido", proxima_data: "2026-06-01", prioridade: "NORMAL" }),
        makeReminder({ id: "hoje", proxima_data: today, prioridade: "ALTA" }),
      ],
    });
    render(<ProjectsKanban projects={[makeProject()]} {...noopProps} />);
    // O vencido (mesmo NORMAL) é mais crítico que hoje/futuro ALTA.
    expect(screen.getByText(/Lembrete vencido/i)).toBeInTheDocument();
    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("10. prioridade ALTA tem destaque visual (chip 'Alta')", () => {
    useProjectsStore.setState({ reminders: [makeReminder({ proxima_data: today, prioridade: "ALTA" })] });
    render(<ProjectsKanban projects={[makeProject()]} {...noopProps} />);
    expect(screen.getByText(/^Alta$/i)).toBeInTheDocument();
  });

  it("15. lembrete RESOLVIDO não aparece como pendente no card", () => {
    useProjectsStore.setState({ reminders: [makeReminder({ status: "RESOLVIDO" })] });
    render(<ProjectsKanban projects={[makeProject()]} {...noopProps} />);
    expect(screen.queryByText(/Lembrete/i)).not.toBeInTheDocument();
  });

  it("2-4 (remoção). lembrete REMOVIDO some do card; com outro ativo, destaca o próximo mais crítico", () => {
    useProjectsStore.setState({
      reminders: [
        makeReminder({ id: "removido", proxima_data: "2026-06-01", status: "CANCELADO" }),
        makeReminder({ id: "restante", proxima_data: futureDate }),
      ],
    });
    render(<ProjectsKanban projects={[makeProject()]} {...noopProps} />);
    // O vencido removido não manda mais; o futuro restante é o destaque, sem "+N".
    expect(screen.queryByText(/Lembrete vencido/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Lembrete em 5d/i)).toBeInTheDocument();
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it("sem lembrete ativo, o card não mostra badge de lembrete", () => {
    render(<ProjectsKanban projects={[makeProject()]} {...noopProps} />);
    expect(screen.queryByText(/Lembrete/i)).not.toBeInTheDocument();
  });

  it("botão de criar lembrete (pin) aparece SÓ quando onCreateReminder é fornecido", () => {
    const { unmount } = render(<ProjectsKanban projects={[makeProject()]} {...noopProps} />);
    expect(screen.queryByRole("button", { name: /Criar lembrete para/i })).not.toBeInTheDocument();
    unmount();

    render(<ProjectsKanban projects={[makeProject()]} {...noopProps} onCreateReminder={() => {}} />);
    expect(screen.getByRole("button", { name: /Criar lembrete para COD-000-0001/i })).toBeInTheDocument();
  });

  it("19-21. lembrete não altera status nem urgência exibidos no card", () => {
    useProjectsStore.setState({ reminders: [makeReminder({ proxima_data: "2026-06-01", prioridade: "ALTA" })] });
    const project = makeProject();
    render(<ProjectsKanban projects={[project]} {...noopProps} />);
    // O card continua na coluna do status original e sem badge de urgência.
    expect(project.status_atual).toBe("ELABORAR ANTE-PROJETO");
    expect(project.urgente).toBe(false);
    expect(screen.queryByText(/URGENTE/i)).not.toBeInTheDocument();
  });
});
