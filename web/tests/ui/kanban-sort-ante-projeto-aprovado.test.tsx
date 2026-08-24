// Kanban — controle de ordenação da coluna ANTE-PROJETO APROVADO.
//
// A coluna não tem SLA/prazo: ordena pela DATA DE ENTRADA no status
// (status_entered_at). Rótulos curtos, sem "vencimento"/"prazo"/"SLA".

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ProjectsKanban } from "@/features/projects/components/projects-kanban";
import type { Project } from "@/features/projects/domain/project-types";

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
    status_atual: "ANTE-PROJETO APROVADO",
    status_entered_at: "2026-07-21T09:00:00.000Z",
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

// Dois projetos em ANTE-PROJETO APROVADO. Lançamento e updated_at são INVERTIDOS
// de propósito em relação à data de entrada, para provar que a ordenação segue
// status_entered_at e não cadastro/atualização:
//  - "ENTROU-HOJE":  entrada 21/07 | lançamento 2026-01-01 | updated_at antigo
//  - "ENTROU-ONTEM": entrada 20/07 | lançamento 2026-12-01 | updated_at novíssimo
function fixtures(): Project[] {
  return [
    makeProject({
      id: "ontem",
      codigo_projeto: "ENTROU-ONTEM-0001",
      status_entered_at: "2026-07-20T09:00:00.000Z",
      data_lancamento: "2026-12-01",
      created_at: "2026-12-01",
      updated_at: "2099-12-31T23:59:59.000Z",
    }),
    makeProject({
      id: "hoje",
      codigo_projeto: "ENTROU-HOJE-0002",
      status_entered_at: "2026-07-21T09:00:00.000Z",
      data_lancamento: "2026-01-01",
      created_at: "2026-01-01",
      updated_at: "2000-01-01T00:00:00.000Z",
    }),
  ];
}

const SORT_BTN = /Ordenar coluna Ante-Projeto Aprovado/i;
const MAIS_RECENTES = /Entrada: mais recentes/i;
const MAIS_ANTIGOS = /Entrada: mais antigos/i;

/** Ordem visual dos códigos renderizados na coluna. */
function renderedCodes(): string[] {
  const ontem = screen.queryAllByText(/ENTROU-ONTEM-0001/);
  const hoje = screen.queryAllByText(/ENTROU-HOJE-0002/);
  return [...ontem, ...hoje]
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .map((el) => el.textContent ?? "");
}

describe("Kanban — ordenação de ANTE-PROJETO APROVADO por data de entrada", () => {
  it("exibe o controle de ordenação nesta coluna", () => {
    render(<ProjectsKanban projects={fixtures()} {...noopProps} />);
    expect(screen.getByRole("button", { name: SORT_BTN })).toBeInTheDocument();
  });

  it("o padrão é 'Entrada: mais recentes' (quem entrou hoje aparece primeiro)", () => {
    render(<ProjectsKanban projects={fixtures()} {...noopProps} />);
    const codes = renderedCodes();
    expect(codes[0]).toMatch(/ENTROU-HOJE/);
    expect(codes[1]).toMatch(/ENTROU-ONTEM/);
  });

  it("o menu oferece só as opções de entrada, sem termos de vencimento/prazo/SLA", async () => {
    const user = userEvent.setup();
    render(<ProjectsKanban projects={fixtures()} {...noopProps} />);

    await user.click(screen.getByRole("button", { name: SORT_BTN }));

    expect(screen.getByRole("menuitemradio", { name: MAIS_RECENTES })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: MAIS_ANTIGOS })).toBeInTheDocument();

    const menu = screen.getByRole("menu");
    expect(menu.textContent ?? "").not.toMatch(/vencimento/i);
    expect(menu.textContent ?? "").not.toMatch(/prazo/i);
    expect(menu.textContent ?? "").not.toMatch(/SLA/i);
  });

  // Caso 6 — trocar recentes ↔ antigos reordena imediatamente (sem recarregar).
  it("6. 'Entrada: mais antigos' reordena na hora (quem está há mais tempo primeiro)", async () => {
    const user = userEvent.setup();
    render(<ProjectsKanban projects={fixtures()} {...noopProps} />);

    await user.click(screen.getByRole("button", { name: SORT_BTN }));
    await user.click(screen.getByRole("menuitemradio", { name: MAIS_ANTIGOS }));

    const codes = renderedCodes();
    expect(codes[0]).toMatch(/ENTROU-ONTEM/);
    expect(codes[1]).toMatch(/ENTROU-HOJE/);
  });

  it("6. voltar para 'Entrada: mais recentes' reordena de novo", async () => {
    const user = userEvent.setup();
    render(<ProjectsKanban projects={fixtures()} {...noopProps} />);

    await user.click(screen.getByRole("button", { name: SORT_BTN }));
    await user.click(screen.getByRole("menuitemradio", { name: MAIS_ANTIGOS }));
    expect(renderedCodes()[0]).toMatch(/ENTROU-ONTEM/);

    await user.click(screen.getByRole("button", { name: SORT_BTN }));
    await user.click(screen.getByRole("menuitemradio", { name: MAIS_RECENTES }));

    expect(renderedCodes()[0]).toMatch(/ENTROU-HOJE/);
  });

  // Caso 4 — updated_at/lançamento não interferem (fixtures são invertidas de propósito).
  it("4. updated_at e data de lançamento não interferem na ordem", async () => {
    const user = userEvent.setup();
    render(<ProjectsKanban projects={fixtures()} {...noopProps} />);

    // "ontem" tem updated_at 2099 e lançamento mais novo; ainda assim fica por último.
    expect(renderedCodes()[0]).toMatch(/ENTROU-HOJE/);

    await user.click(screen.getByRole("button", { name: SORT_BTN }));
    await user.click(screen.getByRole("menuitemradio", { name: MAIS_ANTIGOS }));

    expect(renderedCodes()[0]).toMatch(/ENTROU-ONTEM/);
  });

  // Caso 5 — legado sem data de entrada não quebra o Kanban.
  it("5. projeto sem data de entrada não quebra e fica por último nos dois modos", async () => {
    const user = userEvent.setup();
    const comLegado = [
      makeProject({ id: "sem", codigo_projeto: "SEM-ENTRADA-0003", status_entered_at: "" }),
      ...fixtures(),
    ];
    render(<ProjectsKanban projects={comLegado} {...noopProps} />);

    const posicaoDoLegado = () => {
      const els = [
        ...screen.queryAllByText(/ENTROU-ONTEM-0001/),
        ...screen.queryAllByText(/ENTROU-HOJE-0002/),
        ...screen.queryAllByText(/SEM-ENTRADA-0003/),
      ].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      return els.findIndex((el) => /SEM-ENTRADA-0003/.test(el.textContent ?? ""));
    };

    expect(screen.getByText(/SEM-ENTRADA-0003/)).toBeInTheDocument();
    expect(posicaoDoLegado()).toBe(2); // último

    await user.click(screen.getByRole("button", { name: SORT_BTN }));
    await user.click(screen.getByRole("menuitemradio", { name: MAIS_ANTIGOS }));

    expect(posicaoDoLegado()).toBe(2); // continua último
  });

  // Caso 3 — urgência não muda a posição baseada em entrada.
  it("3. urgência não promove o card ao topo", () => {
    const [ontem, hoje] = fixtures();
    render(
      <ProjectsKanban
        projects={[{ ...ontem, urgente: true, urgentDeadline: "2026-07-25" }, hoje]}
        {...noopProps}
      />,
    );
    // Mesmo urgente, "ontem" continua depois de "hoje" no modo padrão (mais recentes).
    expect(renderedCodes()[0]).toMatch(/ENTROU-HOJE/);
  });
});

// Caso 7 — nenhuma regressão nas demais colunas.
describe("Kanban — sem regressão nas demais colunas", () => {
  it("ELABORAR ANTE-PROJETO mantém o menu por vencimento", async () => {
    const user = userEvent.setup();
    render(
      <ProjectsKanban
        projects={[
          makeProject({
            id: "e1",
            codigo_projeto: "ELAB-0001",
            status_atual: "ELABORAR ANTE-PROJETO",
            deadline: "2026-03-01",
          }),
        ]}
        {...noopProps}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /Ordenar coluna Elaborar Ante-Projeto/i }),
    );
    const menu = screen.getByRole("menu");
    expect(menu.textContent ?? "").toMatch(/vencimento/i);
    expect(menu.textContent ?? "").not.toMatch(/Entrada: mais/i);
  });

  it("PROJETO APROVADO (terminal) não recebe o controle de ordenação", () => {
    render(
      <ProjectsKanban
        projects={[
          makeProject({
            id: "a1",
            codigo_projeto: "APROV-0001",
            status_atual: "PROJETO APROVADO",
          }),
        ]}
        {...noopProps}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Ordenar coluna Projeto Aprovado/i }),
    ).not.toBeInTheDocument();
  });

  it("ANTE-PROJETO ENVIADO não recebe o controle de ordenação", () => {
    render(
      <ProjectsKanban
        projects={[
          makeProject({
            id: "en1",
            codigo_projeto: "ENV-0001",
            status_atual: "ANTE-PROJETO ENVIADO",
          }),
        ]}
        {...noopProps}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Ordenar coluna Ante-Projeto Enviado/i }),
    ).not.toBeInTheDocument();
  });
});
