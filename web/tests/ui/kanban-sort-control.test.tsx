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

// Dois não-urgentes em ELABORAR ANTE-PROJETO onde a ordem por VENCIMENTO difere
// da ordem por ANTIGUIDADE:
//  - "VENCE-CEDO": entered 2026-05-20 (due 2026-07-04) e lançamento 2026-05-20 (mais NOVO)
//  - "VENCE-TARDE": entered 2026-06-20 (due 2026-08-04) e lançamento 2026-01-10 (mais ANTIGO)
// deadline → [VENCE-CEDO, VENCE-TARDE]; oldest → [VENCE-TARDE, VENCE-CEDO].
function fixtures(): Project[] {
  return [
    makeProject({ id: "tarde", codigo_projeto: "VENCE-TARDE-0001", status_entered_at: "2026-06-20", data_lancamento: "2026-01-10", created_at: "2026-01-10" }),
    makeProject({ id: "cedo", codigo_projeto: "VENCE-CEDO-0002", status_entered_at: "2026-05-20", data_lancamento: "2026-05-20", created_at: "2026-05-20" }),
  ];
}

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

describe("Kanban — controle de ordenação (Regra 7: troca sem recarregar)", () => {
  it("modo padrão é Por vencimento (VENCE-CEDO antes de VENCE-TARDE)", () => {
    render(<ProjectsKanban projects={fixtures()} {...noopProps} />);
    const codes = renderedCodes();
    expect(codes[0]).toMatch(/VENCE-CEDO/);
    expect(codes[1]).toMatch(/VENCE-TARDE/);
  });

  it("7. selecionar 'Mais antigo primeiro' reordena a lista sem recarregar", async () => {
    const user = userEvent.setup();
    render(<ProjectsKanban projects={fixtures()} {...noopProps} />);

    // Abre o menu de ordenação da coluna ELABORAR ANTE-PROJETO.
    await user.click(screen.getByRole("button", { name: /Ordenar coluna ELABORAR ANTE-PROJETO/i }));
    await user.click(screen.getByRole("menuitemradio", { name: /Mais antigo primeiro/i }));

    const codes = renderedCodes();
    // Mais antigo (lançamento 2026-01-10 = VENCE-TARDE) agora vem primeiro.
    expect(codes[0]).toMatch(/VENCE-TARDE/);
    expect(codes[1]).toMatch(/VENCE-CEDO/);
  });

  it("selecionar 'Mais novo primeiro' inverte a ordem por antiguidade", async () => {
    const user = userEvent.setup();
    render(<ProjectsKanban projects={fixtures()} {...noopProps} />);

    await user.click(screen.getByRole("button", { name: /Ordenar coluna ELABORAR ANTE-PROJETO/i }));
    await user.click(screen.getByRole("menuitemradio", { name: /Mais novo primeiro/i }));

    const codes = renderedCodes();
    expect(codes[0]).toMatch(/VENCE-CEDO/); // lançamento 2026-05-20 = mais novo
    expect(codes[1]).toMatch(/VENCE-TARDE/);
  });

  it("a opção ativa é marcada (aria-checked) e persiste em localStorage", async () => {
    const user = userEvent.setup();
    render(<ProjectsKanban projects={fixtures()} {...noopProps} />);

    await user.click(screen.getByRole("button", { name: /Ordenar coluna ELABORAR ANTE-PROJETO/i }));
    await user.click(screen.getByRole("menuitemradio", { name: /Mais antigo primeiro/i }));

    // Reabre o menu: a opção escolhida deve estar marcada.
    await user.click(screen.getByRole("button", { name: /Ordenar coluna ELABORAR ANTE-PROJETO/i }));
    const item = screen.getByRole("menuitemradio", { name: /Mais antigo primeiro/i });
    expect(item).toHaveAttribute("aria-checked", "true");

    // Persistência best-effort no localStorage.
    const raw = window.localStorage.getItem("tsteck:kanban:sortModes");
    expect(raw).toContain("oldest");
  });
});
