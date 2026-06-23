import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProjectsKanban } from "@/features/projects/components/projects-kanban";
import type { Project } from "@/features/projects/domain/project-types";

// O master-data store é consumido por outros componentes do board; aqui o
// Kanban em si não depende dele para renderizar os cards. Limpamos localStorage
// entre testes para isolar a persistência do modo de ordenação.
beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    /* jsdom sempre tem localStorage; guard defensivo */
  }
});
afterEach(() => cleanup());

function makeProject(overrides: Partial<Project>): Project {
  return {
    id: "p",
    construtora: "ACRY",
    obra: "OBRA",
    engenheiro_nome: "",
    engenheiro_celular: "",
    equipamento: "EK-15/26",
    tipo_cabine: "",
    codigo_projeto: "COD-000-0000",
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

const noopProps = {
  onMoveStatus: () => ({ ok: true }),
  onOpen: () => {},
  notify: () => {},
  isCodigoDuplicado: () => false,
};

// Dois não-urgentes em ELABORAR ANTE-PROJETO. A dueDate é controlada via `deadline`
// (getCurrentStatusDeadline prioriza project.deadline). A data de LANÇAMENTO é
// invertida de propósito em relação à dueDate, para provar que a ordenação segue
// a DATA DO CARD (dueDate) e NÃO a data de cadastro:
//  - "VENCE-CEDO":  dueDate 2026-03-01 (vence antes) | lançamento 2026-12-01 (cadastro novo)
//  - "VENCE-TARDE": dueDate 2026-11-01 (vence depois) | lançamento 2026-01-01 (cadastro antigo)
// deadline/oldest → [VENCE-CEDO, VENCE-TARDE]; newest → [VENCE-TARDE, VENCE-CEDO].
function fixtures(): Project[] {
  return [
    makeProject({ id: "tarde", codigo_projeto: "VENCE-TARDE-0001", deadline: "2026-11-01", data_lancamento: "2026-01-01", created_at: "2026-01-01" }),
    makeProject({ id: "cedo", codigo_projeto: "VENCE-CEDO-0002", deadline: "2026-03-01", data_lancamento: "2026-12-01", created_at: "2026-12-01" }),
  ];
}

const SORT_BTN = /Ordenar coluna ELABORAR ANTE-PROJETO/i;
const OLD_TO_NEW = /Vencimento: antigo → novo/i;
const NEW_TO_OLD = /Vencimento: novo → antigo/i;

/** Ordem dos códigos renderizados (na única coluna com cards). */
function renderedCodes(): string[] {
  const tarde = screen.queryAllByText(/VENCE-TARDE-0001/);
  const cedo = screen.queryAllByText(/VENCE-CEDO-0002/);
  // posição no documento determina a ordem visual
  const all = [...tarde, ...cedo];
  return all
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .map((el) => el.textContent ?? "");
}

describe("Kanban — controle de ordenação por vencimento (Regra 7: troca sem recarregar)", () => {
  it("modo padrão é Por vencimento (VENCE-CEDO antes de VENCE-TARDE)", () => {
    render(<ProjectsKanban projects={fixtures()} {...noopProps} />);
    const codes = renderedCodes();
    expect(codes[0]).toMatch(/VENCE-CEDO/);
    expect(codes[1]).toMatch(/VENCE-TARDE/);
  });

  it("7. 'Vencimento: antigo → novo' ordena pela dueDate crescente (segue a data do card, não o cadastro)", async () => {
    const user = userEvent.setup();
    render(<ProjectsKanban projects={fixtures()} {...noopProps} />);

    await user.click(screen.getByRole("button", { name: SORT_BTN }));
    await user.click(screen.getByRole("menuitemradio", { name: OLD_TO_NEW }));

    const codes = renderedCodes();
    // dueDate mais antiga (2026-03-01 = VENCE-CEDO) primeiro — apesar de ter o cadastro MAIS NOVO.
    expect(codes[0]).toMatch(/VENCE-CEDO/);
    expect(codes[1]).toMatch(/VENCE-TARDE/);
  });

  it("'Vencimento: novo → antigo' inverte (dueDate decrescente)", async () => {
    const user = userEvent.setup();
    render(<ProjectsKanban projects={fixtures()} {...noopProps} />);

    await user.click(screen.getByRole("button", { name: SORT_BTN }));
    await user.click(screen.getByRole("menuitemradio", { name: NEW_TO_OLD }));

    const codes = renderedCodes();
    // dueDate mais nova (2026-11-01 = VENCE-TARDE) primeiro.
    expect(codes[0]).toMatch(/VENCE-TARDE/);
    expect(codes[1]).toMatch(/VENCE-CEDO/);
  });

  it("a opção ativa é marcada (aria-checked) e persiste em localStorage", async () => {
    const user = userEvent.setup();
    render(<ProjectsKanban projects={fixtures()} {...noopProps} />);

    await user.click(screen.getByRole("button", { name: SORT_BTN }));
    await user.click(screen.getByRole("menuitemradio", { name: OLD_TO_NEW }));

    // Reabre o menu: a opção escolhida deve estar marcada.
    await user.click(screen.getByRole("button", { name: SORT_BTN }));
    const item = screen.getByRole("menuitemradio", { name: OLD_TO_NEW });
    expect(item).toHaveAttribute("aria-checked", "true");

    // Persistência best-effort no localStorage.
    const raw = window.localStorage.getItem("tsteck:kanban:sortModes");
    expect(raw).toContain("oldest");
  });
});
