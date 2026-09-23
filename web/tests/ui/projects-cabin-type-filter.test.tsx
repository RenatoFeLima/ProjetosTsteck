// Filtro "Tipo de Cabine" na pipeline ÚNICA de filtragem da tela de Projetos.
//
// Tudo passa por `filteredProjects()` do store — a mesma lista que o shell
// entrega para Tabela, Kanban, Alertas e para os KPIs do cabeçalho. Por isso os
// testes de Kanban e Tabela abaixo renderizam o RESULTADO do store, e não uma
// lista montada à mão: é a pipeline real que está sendo verificada.
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectsStore } from "@/features/projects/state/projects-store";
import { getCurrentStatusDeadline } from "@/features/projects/domain/project-rules";
import { ProjectsKanban } from "@/features/projects/components/projects-kanban";
import { ProjectsTable } from "@/features/projects/components/projects-table";
import type { Project } from "@/features/projects/domain/project-types";

const SIMPLES = "ct-simples";
const DUPLA = "ct-dupla";
const ESPECIAL = "ct-especial";
const LEGADO = "ct-legado"; // tipo INATIVO com projeto histórico

function makeProject(overrides: Partial<Project>): Project {
  return {
    id: "p",
    construtora: "CONSTRUTORA X",
    obra: "OBRA 1",
    engenheiro_nome: "",
    engenheiro_celular: "",
    equipamento: "EQ-1",
    tipo_cabine: "",
    tipo_cabine_id: null,
    codigo_projeto: "COD-000",
    vendedor: "VENDEDOR A",
    proj_obra_recebido: true,
    local_cabine_definido: true,
    alinhamento: true,
    data_lancamento: "2026-05-01",
    data_alinhamento: "2026-05-02",
    status_atual: "ANTE-PROJETO ENVIADO",
    status_entered_at: "2026-05-10",
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

// Atraso é controlado via `deadline` num status com SLA de desenvolvimento.
const ATRASADO = { status_atual: "ELABORAR ANTE-PROJETO" as const, deadline: "2020-01-10" };

//  id  | tipo     | construtora | obra   | vendedor | equip | status                | urg | atras | código
//  s1  | Simples  | X           | OBRA 1 | A        | EQ-1  | ANTE-PROJETO ENVIADO  |     |       | CRE-100
//  s2  | Simples  | Y           | OBRA 2 | B        | EQ-2  | ELABORAR (atrasado)   | sim | sim   | ABC-200
//  s3  | Simples  | X           | OBRA 1 | B        | EQ-1  | PROJETO FINAL ENVIADO |     |       | CRE-300
//  d1  | Dupla    | X           | OBRA 1 | A        | EQ-1  | ANTE-PROJETO ENVIADO  | sim |       | CRE-400
//  d2  | Dupla    | Y           | OBRA 3 | A        | EQ-2  | ELABORAR (atrasado)   |     | sim   | XYZ-500
//  e1  | Especial | Y           | OBRA 2 | B        | EQ-2  | PROJETO FINAL ENVIADO |     |       | ESP-600
//  l1  | Legado*  | X           | OBRA 3 | A        | EQ-1  | PROJETO APROVADO      |     |       | LEG-700
//  n1  | (null)   | X           | OBRA 1 | A        | EQ-1  | ANTE-PROJETO ENVIADO  |     |       | CRE-800
//  n2  | (ausente)| Y           | OBRA 2 | B        | EQ-2  | CADASTRO INICIAL      |     |       | SEM-900
function fixtures(): Project[] {
  const Y = { construtora: "CONSTRUTORA Y" };
  const B = { vendedor: "VENDEDOR B" };
  const n2 = makeProject({ id: "n2", codigo_projeto: "SEM-900", ...Y, obra: "OBRA 2", ...B, equipamento: "EQ-2", status_atual: "CADASTRO INICIAL" });
  delete n2.tipo_cabine_id; // DTO sem o campo: também é "sem tipo"
  return [
    makeProject({ id: "s1", codigo_projeto: "CRE-100", tipo_cabine_id: SIMPLES }),
    makeProject({ id: "s2", codigo_projeto: "ABC-200", tipo_cabine_id: SIMPLES, ...Y, obra: "OBRA 2", ...B, equipamento: "EQ-2", urgente: true, ...ATRASADO }),
    makeProject({ id: "s3", codigo_projeto: "CRE-300", tipo_cabine_id: SIMPLES, ...B, status_atual: "PROJETO FINAL ENVIADO" }),
    makeProject({ id: "d1", codigo_projeto: "CRE-400", tipo_cabine_id: DUPLA, urgente: true }),
    makeProject({ id: "d2", codigo_projeto: "XYZ-500", tipo_cabine_id: DUPLA, ...Y, obra: "OBRA 3", equipamento: "EQ-2", ...ATRASADO }),
    makeProject({ id: "e1", codigo_projeto: "ESP-600", tipo_cabine_id: ESPECIAL, ...Y, obra: "OBRA 2", ...B, equipamento: "EQ-2", status_atual: "PROJETO FINAL ENVIADO" }),
    makeProject({ id: "l1", codigo_projeto: "LEG-700", tipo_cabine_id: LEGADO, obra: "OBRA 3", status_atual: "PROJETO APROVADO" }),
    makeProject({ id: "n1", codigo_projeto: "CRE-800", tipo_cabine_id: null }),
    n2,
  ];
}

const INITIAL_FILTERS = { ...useProjectsStore.getState().filters };

function setFilters(patch: Partial<typeof INITIAL_FILTERS>) {
  useProjectsStore.getState().setFilters(patch);
}

/** IDs do resultado da pipeline, ordenados para comparação estável. */
function ids(): string[] {
  return useProjectsStore.getState().filteredProjects().map((p) => p.id).sort();
}

beforeEach(() => {
  useProjectsStore.setState({ projects: fixtures(), filters: { ...INITIAL_FILTERS } });
});

afterEach(() => cleanup());

describe("pré-condições das fixtures", () => {
  it("s2 e d2 estão atrasados; os demais não", () => {
    const overdue = fixtures()
      .filter((p) => getCurrentStatusDeadline(p).isOverdue)
      .map((p) => p.id)
      .sort();
    expect(overdue).toEqual(["d2", "s2"]);
  });

  it("o filtro novo nasce vazio", () => {
    expect(INITIAL_FILTERS.tipoCabineId).toBe("");
  });
});

describe("Tipo de Cabine sozinho", () => {
  it("1. sem filtro: todos aparecem, inclusive os sem tipo", () => {
    expect(ids()).toEqual(["d1", "d2", "e1", "l1", "n1", "n2", "s1", "s2", "s3"]);
  });

  it("2. Simples: somente projetos Simples", () => {
    setFilters({ tipoCabineId: SIMPLES });
    expect(ids()).toEqual(["s1", "s2", "s3"]);
  });

  it("3. trocar o tipo muda o resultado imediatamente", () => {
    setFilters({ tipoCabineId: SIMPLES });
    expect(ids()).toEqual(["s1", "s2", "s3"]);
    setFilters({ tipoCabineId: DUPLA });
    expect(ids()).toEqual(["d1", "d2"]);
  });

  it("4. limpar volta ao conjunto anterior", () => {
    setFilters({ tipoCabineId: ESPECIAL });
    expect(ids()).toEqual(["e1"]);
    setFilters({ tipoCabineId: "" });
    expect(ids()).toHaveLength(9);
  });

  it("5. projeto sem tipo (null ou campo ausente) não casa com nenhum tipo", () => {
    for (const tipo of [SIMPLES, DUPLA, ESPECIAL, LEGADO]) {
      setFilters({ tipoCabineId: tipo });
      expect(ids()).not.toContain("n1");
      expect(ids()).not.toContain("n2");
    }
  });

  it("6. tipo INATIVO continua localizando o projeto histórico", () => {
    setFilters({ tipoCabineId: LEGADO });
    expect(ids()).toEqual(["l1"]);
  });

  it("compara por ID: um nome igual em outro campo não interfere", () => {
    // Mesmo que tipo_cabine (nome) coincida, só o ID decide.
    useProjectsStore.setState({
      projects: [
        makeProject({ id: "x1", tipo_cabine: "Simples", tipo_cabine_id: "outro-id" }),
        makeProject({ id: "x2", tipo_cabine: "Simples", tipo_cabine_id: SIMPLES }),
      ],
    });
    setFilters({ tipoCabineId: SIMPLES });
    expect(ids()).toEqual(["x2"]);
  });
});

describe("combinação AND com os filtros existentes", () => {
  it("7. + Vendedor", () => {
    setFilters({ tipoCabineId: SIMPLES, vendedor: "VENDEDOR B" });
    expect(ids()).toEqual(["s2", "s3"]);
  });

  it("8. + Construtora", () => {
    setFilters({ tipoCabineId: SIMPLES, construtora: "CONSTRUTORA X" });
    expect(ids()).toEqual(["s1", "s3"]);
  });

  it("9. + Obra", () => {
    setFilters({ tipoCabineId: DUPLA, obra: "OBRA 3" });
    expect(ids()).toEqual(["d2"]);
  });

  it("10. + Equipamento", () => {
    setFilters({ tipoCabineId: SIMPLES, equipamento: "EQ-2" });
    expect(ids()).toEqual(["s2"]);
  });

  it("11. + Status", () => {
    setFilters({ tipoCabineId: ESPECIAL, status: "PROJETO FINAL ENVIADO" });
    expect(ids()).toEqual(["e1"]);
    setFilters({ tipoCabineId: SIMPLES });
    expect(ids()).toEqual(["s3"]);
  });

  it("12. + Apenas atrasados", () => {
    setFilters({ tipoCabineId: DUPLA, atrasadoOnly: true });
    expect(ids()).toEqual(["d2"]);
  });

  it("13. + Apenas urgentes", () => {
    setFilters({ tipoCabineId: DUPLA, urgenteOnly: true });
    expect(ids()).toEqual(["d1"]);
  });

  it("14. + busca textual", () => {
    setFilters({ search: "CRE" });
    expect(ids()).toEqual(["d1", "n1", "s1", "s3"]);
    setFilters({ tipoCabineId: DUPLA });
    expect(ids()).toEqual(["d1"]);
  });

  it("várias ao mesmo tempo (Construtora + Vendedor + Tipo)", () => {
    setFilters({ construtora: "CONSTRUTORA X", vendedor: "VENDEDOR A", tipoCabineId: DUPLA });
    expect(ids()).toEqual(["d1"]);
  });

  it("combinação sem resultado devolve lista vazia", () => {
    setFilters({ tipoCabineId: ESPECIAL, urgenteOnly: true });
    expect(ids()).toEqual([]);
  });

  it("limpar o tipo NÃO limpa os demais filtros", () => {
    setFilters({ vendedor: "VENDEDOR A", tipoCabineId: DUPLA });
    expect(ids()).toEqual(["d1", "d2"]);

    setFilters({ tipoCabineId: "" });
    const f = useProjectsStore.getState().filters;
    expect(f.vendedor).toBe("VENDEDOR A");
    expect(ids()).toEqual(["d1", "d2", "l1", "n1", "s1"]);
  });
});

describe("sem regressão nos filtros existentes (tipo vazio)", () => {
  it.each([
    [{ vendedor: "VENDEDOR A" }, ["d1", "d2", "l1", "n1", "s1"]],
    [{ construtora: "CONSTRUTORA Y" }, ["d2", "e1", "n2", "s2"]],
    [{ obra: "OBRA 2" }, ["e1", "n2", "s2"]],
    [{ equipamento: "EQ-2" }, ["d2", "e1", "n2", "s2"]],
    [{ status: "PROJETO FINAL ENVIADO" as const }, ["e1", "s3"]],
    [{ atrasadoOnly: true }, ["d2", "s2"]],
    [{ urgenteOnly: true }, ["d1", "s2"]],
    [{ search: "xyz" }, ["d2"]],
  ])("%o", (patch, expected) => {
    setFilters(patch);
    expect(ids()).toEqual(expected);
  });
});

// ─── Visualizações: recebem o resultado da MESMA pipeline ──────────────────

const kanbanProps = {
  onMoveStatus: () => ({ ok: true }),
  onOpen: () => {},
  notify: () => {},
  isCodigoDuplicado: () => false,
};

/** Contagem exibida no cabeçalho da coluna do Kanban ("N projeto(s)"). */
function columnCount(label: string): number {
  const heading = screen.getAllByTitle(label).find((el) => el.tagName === "H3");
  if (!heading) throw new Error(`coluna não encontrada: ${label}`);
  const section = heading.closest("section") as HTMLElement;
  const pill = within(section).getByText(/^\d+ projetos?$/);
  return Number(pill.textContent?.split(" ")[0]);
}

describe("15. Kanban — contadores refletem o resultado filtrado", () => {
  it("sem filtro vs. filtrado por Dupla", () => {
    const { unmount } = render(
      <ProjectsKanban projects={useProjectsStore.getState().filteredProjects()} {...kanbanProps} />,
    );
    // s1, d1, n1 estão em ANTE-PROJETO ENVIADO.
    expect(columnCount("Ante-Projeto Enviado")).toBe(3);
    expect(columnCount("Elaborar Ante-Projeto")).toBe(2);
    unmount();

    setFilters({ tipoCabineId: DUPLA });
    render(<ProjectsKanban projects={useProjectsStore.getState().filteredProjects()} {...kanbanProps} />);
    expect(columnCount("Ante-Projeto Enviado")).toBe(1);
    expect(columnCount("Elaborar Ante-Projeto")).toBe(1);
    expect(columnCount("Projeto Final Enviado")).toBe(0);
  });

  it("nenhum card fora do filtro permanece", () => {
    setFilters({ tipoCabineId: DUPLA });
    render(<ProjectsKanban projects={useProjectsStore.getState().filteredProjects()} {...kanbanProps} />);
    expect(screen.queryAllByText("CRE-400").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("XYZ-500").length).toBeGreaterThan(0);
    for (const fora of ["CRE-100", "ABC-200", "CRE-300", "ESP-600", "LEG-700", "CRE-800", "SEM-900"]) {
      expect(screen.queryAllByText(fora)).toHaveLength(0);
    }
  });
});

describe("16. Tabela — recebe o mesmo filtro", () => {
  it("mostra só os projetos do tipo selecionado", () => {
    setFilters({ tipoCabineId: SIMPLES });
    render(
      <ProjectsTable
        projects={useProjectsStore.getState().filteredProjects()}
        onViewDetails={vi.fn()}
        onEditProject={vi.fn()}
        onChangeStatus={vi.fn()}
        onViewHistory={vi.fn()}
        onMarkUrgente={vi.fn()}
        onRemoveUrgente={vi.fn()}
      />,
    );
    for (const dentro of ["CRE-100", "ABC-200", "CRE-300"]) {
      expect(screen.queryAllByText(dentro).length).toBeGreaterThan(0);
    }
    for (const fora of ["CRE-400", "XYZ-500", "ESP-600", "LEG-700", "CRE-800", "SEM-900"]) {
      expect(screen.queryAllByText(fora)).toHaveLength(0);
    }
  });
});
