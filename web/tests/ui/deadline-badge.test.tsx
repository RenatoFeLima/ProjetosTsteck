import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DeadlineBadge } from "@/features/projects/components/pill-badges";
import type { Project } from "@/features/projects/domain/project-types";

afterEach(() => cleanup());

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    construtora: "ACRY",
    obra: "OBRA",
    engenheiro_nome: "",
    engenheiro_celular: "",
    equipamento: "EK-15/26",
    tipo_cabine: "",
    codigo_projeto: "ABC-123-4567",
    vendedor: "RENATO",
    proj_obra_recebido: true,
    local_cabine_definido: true,
    alinhamento: true,
    data_lancamento: "2026-05-01",
    data_alinhamento: "2026-05-05",
    status_atual: "ELABORAR ANTE-PROJETO",
    status_entered_at: "2026-05-27", // due = 2026-05-27 + 45d = 2026-07-11
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

describe("DeadlineBadge — prazo normal com data (Regra 3/4)", () => {
  it("8. card não urgente em ELABORAR ANTE-PROJETO mostra Xd restantes/atraso + data dd/MM/yyyy", () => {
    // status_entered_at 2026-05-27 → vencimento 11/07/2026 (45 dias corridos).
    render(<DeadlineBadge project={makeProject()} />);

    // A data final deve aparecer (independe de "hoje").
    expect(screen.getByText("11/07/2026")).toBeInTheDocument();

    // O texto de prazo (restantes/atraso/vence hoje) também deve estar presente.
    expect(screen.getByText(/restantes|atraso|Vence hoje/i)).toBeInTheDocument();
  });

  it("não renderiza nada para projeto urgente (urgência tem prioridade visual)", () => {
    const { container } = render(
      <DeadlineBadge project={makeProject({ urgente: true, urgentDeadline: "2026-07-01" })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza data em status sem prazo operacional", () => {
    const { container } = render(
      <DeadlineBadge project={makeProject({ status_atual: "ANTE-PROJETO APROVADO" })} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
