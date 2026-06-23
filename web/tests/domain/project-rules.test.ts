import { describe, expect, it } from "vitest";
import {
  applyAlignmentAutomation,
  computeOperationalKpis,
  computePrazoBadge,
  computePrazoEntrega,
  countBusinessDays,
  shouldShowOperationalDeadline,
  sortProjectsForKanban,
  DEFAULT_KANBAN_SORT_MODE,
  toDateInputValue,
  transitionStatus,
} from "@/features/projects/domain/project-rules";
import type { Project } from "@/features/projects/domain/project-types";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    construtora: "ACRY",
    obra: "ARTHUR DE AZEVEDO",
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

describe("project rules", () => {
  it("normaliza datas para input type=date (yyyy-MM-dd)", () => {
    // ISO completo (origem do warning) -> só a porção de data, sem deslocar fuso.
    expect(toDateInputValue("2026-06-09T15:47:39.159Z")).toBe("2026-06-09");
    // Já em yyyy-MM-dd -> inalterado.
    expect(toDateInputValue("2026-06-09")).toBe("2026-06-09");
    // Date object -> yyyy-MM-dd.
    expect(toDateInputValue(new Date("2026-06-09T00:00:00.000Z"))).toBe("2026-06-09");
    // Vazio/nulo/ inválido -> string vazia.
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue(undefined)).toBe("");
    expect(toDateInputValue("")).toBe("");
  });

  it("calcula prazo de entrega com +45 dias", () => {
    expect(computePrazoEntrega("2026-05-01")).toBe("2026-06-15");
  });

  it("recalcula prazo quando data alinhamento muda", () => {
    const oldPrazo = computePrazoEntrega("2026-05-01");
    const newPrazo = computePrazoEntrega("2026-05-10");
    expect(oldPrazo).toBe("2026-06-15");
    expect(newPrazo).toBe("2026-06-24");
  });

  it("nao inicia contagem de prazo sem local da cabine e projeto da obra marcados", () => {
    expect(computePrazoEntrega("2026-05-01", false)).toBeNull();
    expect(computePrazoEntrega("2026-05-01", true)).toBe("2026-06-15");
  });

  describe("shouldShowOperationalDeadline", () => {
    it("mostra prazo apenas nos status com SLA operacional ativo (sem urgência)", () => {
      expect(shouldShowOperationalDeadline(makeProject({ status_atual: "ELABORAR ANTE-PROJETO" }))).toBe(true);
      expect(shouldShowOperationalDeadline(makeProject({ status_atual: "REVISAO DE ESTUDO" }))).toBe(true);
      expect(shouldShowOperationalDeadline(makeProject({ status_atual: "REVISAO DE PROJETO FINAL" }))).toBe(true);
    });

    it("não mostra prazo nos status sem SLA operacional (sem urgência)", () => {
      expect(shouldShowOperationalDeadline(makeProject({ status_atual: "CADASTRO INICIAL" }))).toBe(false);
      expect(shouldShowOperationalDeadline(makeProject({ status_atual: "ANTE-PROJETO ENVIADO" }))).toBe(false);
      expect(shouldShowOperationalDeadline(makeProject({ status_atual: "ANTE-PROJETO APROVADO" }))).toBe(false);
      expect(shouldShowOperationalDeadline(makeProject({ status_atual: "PROJETO FINAL ENVIADO" }))).toBe(false);
      expect(shouldShowOperationalDeadline(makeProject({ status_atual: "PROJETO APROVADO" }))).toBe(false);
    });

    it("urgência tem prioridade: nunca mostra prazo operacional, mesmo em status com SLA", () => {
      expect(shouldShowOperationalDeadline(makeProject({ status_atual: "ELABORAR ANTE-PROJETO", urgente: true }))).toBe(false);
      expect(shouldShowOperationalDeadline(makeProject({ status_atual: "REVISAO DE ESTUDO", urgente: true }))).toBe(false);
      expect(shouldShowOperationalDeadline(makeProject({ status_atual: "ANTE-PROJETO ENVIADO", urgente: true }))).toBe(false);
    });
  });

  it("badge atrasado quando passou da data", () => {
    expect(computePrazoBadge("2026-06-20", "2026-06-15")).toBe("atrasado");
  });

  it("sugere alinhamento quando pre-requisitos estao true", () => {
    const result = applyAlignmentAutomation({
      proj_obra_recebido: true,
      local_cabine_definido: true,
      alinhamento: false,
      data_alinhamento: null,
    });
    expect(result.alinhamentoSuggested).toBe(true);
    expect(result.nextDataAlinhamento).not.toBeNull();
  });

  it("aplica data_envio automaticamente na transicao", () => {
    const result = transitionStatus({
      currentStatus: "ELABORAR ANTE-PROJETO",
      nextStatus: "ANTE-PROJETO ENVIADO",
      aligned: true,
      today: "2026-05-26",
      data_envio: null,
      data_aprovacao: null,
    });
    expect(result.data_envio).toBe("2026-05-26");
  });

  it("calcula KPIs operacionais e estado do SLA", () => {
    const project = makeProject();
    const statusHistory = [
      {
        id: "h1",
        projeto_id: project.id,
        status_de: "CADASTRO INICIAL" as const,
        status_para: "ELABORAR ANTE-PROJETO" as const,
        alterado_em: "2026-05-20",
        origem: "kanban" as const,
      },
    ];

    const kpis = computeOperationalKpis(project, statusHistory, "2026-05-28");

    expect(kpis.diasDesdeCadastro).toBe(27);
    expect(kpis.diasSemAtualizacao).toBe(18);
    expect(kpis.diasNoStatusAtual).toBe(8);
    expect(kpis.slaTargetDias).toBe(10);
    expect(kpis.slaRestanteDias).toBe(2);
    expect(kpis.slaState).toBe("atencao");
  });

  it("marca SLA estourado quando ultrapassa o limite do status", () => {
    const project = makeProject({
      status_atual: "REVISAO DE ESTUDO",
      created_at: "2026-05-01",
    });

    const statusHistory = [
      {
        id: "h2",
        projeto_id: project.id,
        status_de: "PROJETO APROVADO" as const,
        status_para: "REVISAO DE ESTUDO" as const,
        alterado_em: "2026-05-10",
        origem: "formulario" as const,
      },
    ];

    const kpis = computeOperationalKpis(project, statusHistory, "2026-05-20");
    expect(kpis.slaTargetDias).toBe(4);
    expect(kpis.slaRestanteDias).toBe(-6);
    expect(kpis.slaState).toBe("estourado");
  });
});

describe("sortProjectsForKanban", () => {
  function p(id: string, urgente: boolean, urgentDeadline?: string | null): Parameters<typeof makeProject>[0] & { id: string } {
    return { id, urgente, urgentDeadline: urgentDeadline ?? null } as never;
  }

  it("urgentes sempre vêm antes dos não-urgentes", () => {
    const projects = [makeProject(p("a", false)), makeProject(p("b", true, "2026-12-31"))];
    const sorted = sortProjectsForKanban(projects);
    expect(sorted[0].id).toBe("b");
    expect(sorted[1].id).toBe("a");
  });

  it("urgentes com deadline ordenados por data crescente (vencido primeiro)", () => {
    const projects = [
      makeProject(p("futuro", true, "2026-12-31")),
      makeProject(p("vencido", true, "2026-01-01")),
      makeProject(p("hoje", true, "2026-06-17")),
    ];
    const sorted = sortProjectsForKanban(projects);
    expect(sorted.map((proj) => proj.id)).toEqual(["vencido", "hoje", "futuro"]);
  });

  it("urgentes sem deadline vêm depois dos urgentes com deadline", () => {
    const projects = [
      makeProject(p("sem-dl", true, null)),
      makeProject(p("com-dl", true, "2026-07-01")),
    ];
    const sorted = sortProjectsForKanban(projects);
    expect(sorted[0].id).toBe("com-dl");
    expect(sorted[1].id).toBe("sem-dl");
  });

  it("não-urgentes mantêm ordem estável entre si", () => {
    const projects = [makeProject(p("x", false)), makeProject(p("y", false)), makeProject(p("z", false))];
    const sorted = sortProjectsForKanban(projects);
    expect(sorted.map((proj) => proj.id)).toEqual(["x", "y", "z"]);
  });

  it("ordem completa: urgente+deadline < urgente+sem-deadline < não-urgente", () => {
    const projects = [
      makeProject(p("normal", false)),
      makeProject(p("urg-sem", true, null)),
      makeProject(p("urg-com", true, "2026-08-15")),
    ];
    const sorted = sortProjectsForKanban(projects);
    expect(sorted.map((proj) => proj.id)).toEqual(["urg-com", "urg-sem", "normal"]);
  });

  // ── Regra 1: não-urgentes ordenados pelo prazo NORMAL do status ──────────────
  // dueDate = status_entered_at + 45d (ELABORAR ANTE-PROJETO). A ordem por dueDate
  // independe de "hoje", então os testes são determinísticos.
  function elaborar(id: string, enteredAt: string | null): Project {
    return makeProject({
      id,
      urgente: false,
      status_atual: "ELABORAR ANTE-PROJETO",
      status_entered_at: enteredAt as string,
    } as Partial<Project>);
  }

  it("3. não-urgentes em ELABORAR ANTE-PROJETO ordenados por prazo normal crescente", () => {
    // entered mais antigo → dueDate mais cedo → aparece primeiro.
    const projects = [
      elaborar("tarde", "2026-05-20"), // due 2026-07-04
      elaborar("cedo", "2026-04-01"), // due 2026-05-16
      elaborar("meio", "2026-05-01"), // due 2026-06-15
    ];
    const sorted = sortProjectsForKanban(projects);
    expect(sorted.map((x) => x.id)).toEqual(["cedo", "meio", "tarde"]);
  });

  it("4. dentro dos não-urgentes, vencidos (dueDate menor) vêm antes dos no prazo", () => {
    const projects = [
      elaborar("no-prazo", "2030-01-01"), // due bem no futuro
      elaborar("vencido", "2020-01-01"), // due bem no passado
    ];
    const sorted = sortProjectsForKanban(projects);
    expect(sorted.map((x) => x.id)).toEqual(["vencido", "no-prazo"]);
  });

  it("5. não-urgentes sem prazo calculável ficam no final", () => {
    const projects = [
      makeProject({ id: "sem-prazo", urgente: false, status_atual: "ANTE-PROJETO APROVADO" } as Partial<Project>),
      elaborar("com-prazo", "2026-04-01"),
    ];
    const sorted = sortProjectsForKanban(projects);
    expect(sorted.map((x) => x.id)).toEqual(["com-prazo", "sem-prazo"]);
  });

  it("1+3 combinados: urgentes no topo (por urgentDeadline), depois não-urgentes por prazo normal", () => {
    const projects = [
      elaborar("nao-tarde", "2026-05-20"), // due 2026-07-04
      makeProject({ id: "urg-futuro", urgente: true, urgentDeadline: "2026-12-31", status_atual: "ELABORAR ANTE-PROJETO" } as Partial<Project>),
      elaborar("nao-cedo", "2026-04-01"), // due 2026-05-16
      makeProject({ id: "urg-vencido", urgente: true, urgentDeadline: "2026-01-01", status_atual: "ELABORAR ANTE-PROJETO" } as Partial<Project>),
    ];
    const sorted = sortProjectsForKanban(projects);
    expect(sorted.map((x) => x.id)).toEqual(["urg-vencido", "urg-futuro", "nao-cedo", "nao-tarde"]);
  });
});

// ── Controle de ordenação do Kanban (modos deadline/oldest/newest) ────────────
describe("sortProjectsForKanban — modos de ordenação", () => {
  // Projeto não-urgente em ELABORAR ANTE-PROJETO com data base (lançamento) controlada.
  function nu(id: string, dataLancamento: string | null, enteredAt = "2026-05-05"): Project {
    return makeProject({
      id,
      urgente: false,
      status_atual: "ELABORAR ANTE-PROJETO",
      status_entered_at: enteredAt,
      data_lancamento: dataLancamento as string,
      created_at: dataLancamento as string,
    } as Partial<Project>);
  }

  it("1. modo padrão é 'deadline' (chamar sem modo == chamar com 'deadline')", () => {
    const projects = [nu("a", "2026-01-01", "2026-05-20"), nu("b", "2026-02-01", "2026-04-01")];
    expect(sortProjectsForKanban(projects).map((x) => x.id)).toEqual(
      sortProjectsForKanban(projects, "deadline").map((x) => x.id),
    );
    expect(DEFAULT_KANBAN_SORT_MODE).toBe("deadline");
  });

  it("2. urgentes continuam no topo em TODOS os modos", () => {
    const projects = [
      nu("nao1", "2020-01-01"),
      makeProject({ id: "urg", urgente: true, urgentDeadline: "2026-12-31", status_atual: "ELABORAR ANTE-PROJETO" } as Partial<Project>),
      nu("nao2", "2030-01-01"),
    ];
    for (const mode of ["deadline", "oldest", "newest"] as const) {
      expect(sortProjectsForKanban(projects, mode)[0].id).toBe("urg");
    }
  });

  it("4. 'oldest' ordena não-urgentes do mais antigo para o mais novo (por data de lançamento)", () => {
    const projects = [
      nu("novo", "2026-06-01"),
      nu("antigo", "2026-01-01"),
      nu("meio", "2026-03-01"),
    ];
    expect(sortProjectsForKanban(projects, "oldest").map((x) => x.id)).toEqual(["antigo", "meio", "novo"]);
  });

  it("5. 'newest' ordena não-urgentes do mais novo para o mais antigo", () => {
    const projects = [
      nu("antigo", "2026-01-01"),
      nu("novo", "2026-06-01"),
      nu("meio", "2026-03-01"),
    ];
    expect(sortProjectsForKanban(projects, "newest").map((x) => x.id)).toEqual(["novo", "meio", "antigo"]);
  });

  it("6. sem data base calculável ficam no final em 'oldest' E em 'newest'", () => {
    const semData = makeProject({ id: "sem", urgente: false, status_atual: "ELABORAR ANTE-PROJETO", data_lancamento: "" , created_at: "" } as Partial<Project>);
    const comData = nu("com", "2026-02-01");
    expect(sortProjectsForKanban([semData, comData], "oldest").map((x) => x.id)).toEqual(["com", "sem"]);
    expect(sortProjectsForKanban([semData, comData], "newest").map((x) => x.id)).toEqual(["com", "sem"]);
  });

  it("oldest/newest: urgentes no topo por urgentDeadline, depois não-urgentes pela data base", () => {
    const projects = [
      nu("nao-novo", "2026-06-01"),
      makeProject({ id: "urg-futuro", urgente: true, urgentDeadline: "2026-12-31", status_atual: "ELABORAR ANTE-PROJETO" } as Partial<Project>),
      nu("nao-antigo", "2026-01-01"),
      makeProject({ id: "urg-vencido", urgente: true, urgentDeadline: "2026-01-01", status_atual: "ELABORAR ANTE-PROJETO" } as Partial<Project>),
    ];
    expect(sortProjectsForKanban(projects, "oldest").map((x) => x.id)).toEqual([
      "urg-vencido", "urg-futuro", "nao-antigo", "nao-novo",
    ]);
    expect(sortProjectsForKanban(projects, "newest").map((x) => x.id)).toEqual([
      "urg-vencido", "urg-futuro", "nao-novo", "nao-antigo",
    ]);
  });
});

describe("countBusinessDays", () => {
  it("retorna 0 quando as datas são iguais", () => {
    const d = new Date("2026-06-17");
    expect(countBusinessDays(d, d)).toBe(0);
  });

  it("conta dias úteis de segunda a sexta (semana cheia = 5)", () => {
    // seg 16/06 → sex 20/06 = 4 dias contados a partir de seg (ter, qua, qui, sex)
    expect(countBusinessDays(new Date("2026-06-16"), new Date("2026-06-20"))).toBe(4);
  });

  it("pula fim de semana: seg → próxima seg = 5 dias úteis", () => {
    expect(countBusinessDays(new Date("2026-06-16"), new Date("2026-06-23"))).toBe(5);
  });

  it("retorna negativo quando to está no passado", () => {
    expect(countBusinessDays(new Date("2026-06-20"), new Date("2026-06-16"))).toBe(-4);
  });

  it("sábado e domingo não contam", () => {
    // sex 19/06 → seg 22/06 = 1 dia útil (apenas a seg conta)
    expect(countBusinessDays(new Date("2026-06-19"), new Date("2026-06-22"))).toBe(1);
  });
});
