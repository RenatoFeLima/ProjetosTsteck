import { describe, expect, it } from "vitest";
import {
  applyAlignmentAutomation,
  computeOperationalKpis,
  hasDevelopmentSla,
  isOperationalStatus,
  OPERATIONAL_ACTIVE_STATUSES,
  getCurrentStatusDeadline,
  computePrazoBadge,
  computePrazoEntrega,
  countBusinessDays,
  shouldShowOperationalDeadline,
  sortProjectsForKanban,
  sortProjectsByCodeDesc,
  getCodeNumericSuffix,
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
// TODOS os modos ordenam os não-urgentes pela DATA DE VENCIMENTO do card
// (getCurrentStatusDeadline.dueDate), NÃO por data de cadastro/lançamento.
describe("sortProjectsForKanban — modos de ordenação por data de vencimento", () => {
  // Não-urgente em ELABORAR ANTE-PROJETO com dueDate controlada via `deadline`
  // (getCurrentStatusDeadline prioriza project.deadline sobre o cálculo por status).
  // `data_lancamento`/`created_at` recebem datas PROPOSITALMENTE diferentes da
  // dueDate para provar que a ordenação NÃO usa a data de cadastro.
  function nu(id: string, dueDate: string | null): Project {
    return makeProject({
      id,
      urgente: false,
      status_atual: "ELABORAR ANTE-PROJETO",
      deadline: dueDate,
      // datas de cadastro "trocadas" de propósito (não devem influenciar a ordem):
      data_lancamento: "2026-01-01",
      created_at: "2026-01-01",
    } as Partial<Project>);
  }

  it("1. modo padrão é 'deadline'", () => {
    const projects = [nu("a", "2026-08-02"), nu("b", "2026-06-26")];
    expect(sortProjectsForKanban(projects).map((x) => x.id)).toEqual(
      sortProjectsForKanban(projects, "deadline").map((x) => x.id),
    );
    expect(DEFAULT_KANBAN_SORT_MODE).toBe("deadline");
  });

  it("2. urgentes continuam no topo em TODOS os modos", () => {
    const projects = [
      nu("nao1", "2026-02-01"),
      makeProject({ id: "urg", urgente: true, urgentDeadline: "2026-12-31", status_atual: "ELABORAR ANTE-PROJETO" } as Partial<Project>),
      nu("nao2", "2026-09-01"),
    ];
    for (const mode of ["deadline", "oldest", "newest"] as const) {
      expect(sortProjectsForKanban(projects, mode)[0].id).toBe("urg");
    }
  });

  // Exemplo real do enunciado: A=02/08, B=26/06, C=07/02, D=17/07.
  it("3+4. 'oldest' ordena não-urgentes pela dueDate crescente (exemplo do enunciado: C,B,D,A)", () => {
    const projects = [
      nu("A", "2026-08-02"),
      nu("B", "2026-06-26"),
      nu("C", "2026-02-07"),
      nu("D", "2026-07-17"),
    ];
    expect(sortProjectsForKanban(projects, "oldest").map((x) => x.id)).toEqual(["C", "B", "D", "A"]);
  });

  it("3+5. 'newest' ordena não-urgentes pela dueDate decrescente (exemplo do enunciado: A,D,B,C)", () => {
    const projects = [
      nu("A", "2026-08-02"),
      nu("B", "2026-06-26"),
      nu("C", "2026-02-07"),
      nu("D", "2026-07-17"),
    ];
    expect(sortProjectsForKanban(projects, "newest").map((x) => x.id)).toEqual(["A", "D", "B", "C"]);
  });

  it("ordenação NÃO usa data de cadastro: cards mais 'novos' de cadastro podem vencer antes", () => {
    // dueDate manda; data_lancamento é igual em todos, então não interfere.
    const projects = [nu("vence-depois", "2026-12-31"), nu("vence-antes", "2026-03-01")];
    expect(sortProjectsForKanban(projects, "oldest").map((x) => x.id)).toEqual(["vence-antes", "vence-depois"]);
    expect(sortProjectsForKanban(projects, "newest").map((x) => x.id)).toEqual(["vence-depois", "vence-antes"]);
  });

  it("6. sem dueDate calculável ficam no final em 'oldest' E em 'newest'", () => {
    // status sem prazo operacional e sem `deadline` → dueDate ausente.
    const semPrazo = makeProject({ id: "sem", urgente: false, status_atual: "ANTE-PROJETO APROVADO", deadline: null } as Partial<Project>);
    const comPrazo = nu("com", "2026-02-01");
    expect(sortProjectsForKanban([semPrazo, comPrazo], "oldest").map((x) => x.id)).toEqual(["com", "sem"]);
    expect(sortProjectsForKanban([semPrazo, comPrazo], "newest").map((x) => x.id)).toEqual(["com", "sem"]);
  });

  it("oldest/newest: urgentes no topo por urgentDeadline, depois não-urgentes pela dueDate", () => {
    const projects = [
      nu("nao-vence-tarde", "2026-09-01"),
      makeProject({ id: "urg-futuro", urgente: true, urgentDeadline: "2026-12-31", status_atual: "ELABORAR ANTE-PROJETO" } as Partial<Project>),
      nu("nao-vence-cedo", "2026-03-01"),
      makeProject({ id: "urg-vencido", urgente: true, urgentDeadline: "2026-01-01", status_atual: "ELABORAR ANTE-PROJETO" } as Partial<Project>),
    ];
    expect(sortProjectsForKanban(projects, "oldest").map((x) => x.id)).toEqual([
      "urg-vencido", "urg-futuro", "nao-vence-cedo", "nao-vence-tarde",
    ]);
    expect(sortProjectsForKanban(projects, "newest").map((x) => x.id)).toEqual([
      "urg-vencido", "urg-futuro", "nao-vence-tarde", "nao-vence-cedo",
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

describe("getCodeNumericSuffix", () => {
  it("extrai os 4 últimos dígitos do código", () => {
    expect(getCodeNumericSuffix("CRE-UBA-2060")).toBe(2060);
    expect(getCodeNumericSuffix("CRE-NAC-2059")).toBe(2059);
  });

  it("retorna null para código vazio, nulo ou sem 4 dígitos finais", () => {
    expect(getCodeNumericSuffix("")).toBeNull();
    expect(getCodeNumericSuffix(null)).toBeNull();
    expect(getCodeNumericSuffix(undefined)).toBeNull();
    expect(getCodeNumericSuffix("CRE-UBA-206")).toBeNull(); // só 3 dígitos
    expect(getCodeNumericSuffix("PROVISORIO")).toBeNull();
    expect(getCodeNumericSuffix("CRE-2060-AB")).toBeNull(); // não termina em dígitos
  });
});

describe("sortProjectsByCodeDesc — colunas de projeto final", () => {
  const proj = (id: string, codigo: string, status: Project["status_atual"]) =>
    makeProject({ id, codigo_projeto: codigo, status_atual: status } as Partial<Project>);

  it("1/7. ordena PROJETO FINAL ENVIADO por sufixo desc (exemplo real)", () => {
    const input = [
      proj("a", "CRE-AGA-2056", "PROJETO FINAL ENVIADO"),
      proj("b", "CRE-TIQ-2058", "PROJETO FINAL ENVIADO"),
      proj("c", "CRE-UBA-2060", "PROJETO FINAL ENVIADO"),
      proj("d", "CRE-NAC-2059", "PROJETO FINAL ENVIADO"),
      proj("e", "CRE-TIQ-2057", "PROJETO FINAL ENVIADO"),
    ];
    expect(sortProjectsByCodeDesc(input).map((x) => x.codigo_projeto)).toEqual([
      "CRE-UBA-2060", "CRE-NAC-2059", "CRE-TIQ-2058", "CRE-TIQ-2057", "CRE-AGA-2056",
    ]);
  });

  it("2. ordena PROJETO APROVADO pela mesma lógica (desc)", () => {
    const input = [
      proj("a", "CRE-AAA-1001", "PROJETO APROVADO"),
      proj("b", "CRE-BBB-1003", "PROJETO APROVADO"),
      proj("c", "CRE-CCC-1002", "PROJETO APROVADO"),
    ];
    expect(sortProjectsByCodeDesc(input).map((x) => x.codigo_projeto)).toEqual([
      "CRE-BBB-1003", "CRE-CCC-1002", "CRE-AAA-1001",
    ]);
  });

  it("4/5. código sem 4 dígitos finais ou vazio vai para o fim", () => {
    const input = [
      proj("invalido", "PROVISORIO", "PROJETO FINAL ENVIADO"),
      proj("vazio", "", "PROJETO FINAL ENVIADO"),
      proj("baixo", "CRE-XXX-2050", "PROJETO FINAL ENVIADO"),
      proj("alto", "CRE-YYY-2061", "PROJETO FINAL ENVIADO"),
    ];
    const ids = sortProjectsByCodeDesc(input).map((x) => x.id);
    expect(ids.slice(0, 2)).toEqual(["alto", "baixo"]);
    // Os dois inválidos ficam no fim, preservando ordem de entrada (estável).
    expect(ids.slice(2)).toEqual(["invalido", "vazio"]);
  });

  it("6. sufixos iguais mantêm fallback estável (ordem de entrada)", () => {
    const input = [
      proj("primeiro", "CRE-AAA-2060", "PROJETO FINAL ENVIADO"),
      proj("segundo", "CRE-BBB-2060", "PROJETO FINAL ENVIADO"),
      proj("terceiro", "CRE-CCC-2060", "PROJETO FINAL ENVIADO"),
    ];
    expect(sortProjectsByCodeDesc(input).map((x) => x.id)).toEqual([
      "primeiro", "segundo", "terceiro",
    ]);
  });
});

describe("hasDevelopmentSla — status com SLA de desenvolvimento", () => {
  it("true apenas para ELABORAR ANTE-PROJETO / REVISAO DE ESTUDO / REVISAO DE PROJETO FINAL", () => {
    expect(hasDevelopmentSla("ELABORAR ANTE-PROJETO")).toBe(true);
    expect(hasDevelopmentSla("REVISAO DE ESTUDO")).toBe(true);
    expect(hasDevelopmentSla("REVISAO DE PROJETO FINAL")).toBe(true);
  });

  it("false para todos os demais status (sem SLA/atraso operacional)", () => {
    expect(hasDevelopmentSla("CADASTRO INICIAL")).toBe(false);
    expect(hasDevelopmentSla("ANTE-PROJETO ENVIADO")).toBe(false);
    expect(hasDevelopmentSla("ANTE-PROJETO APROVADO")).toBe(false);
    expect(hasDevelopmentSla("PROJETO FINAL ENVIADO")).toBe(false);
    expect(hasDevelopmentSla("PROJETO APROVADO")).toBe(false);
  });
});

describe("SLA/atraso restrito aos status de desenvolvimento", () => {
  const withStatusEntered = (status: Project["status_atual"], enteredAt: string, extra: Partial<Project> = {}) =>
    makeProject({ status_atual: status, status_entered_at: enteredAt, created_at: enteredAt, ...extra } as Partial<Project>);
  const history = (status: Project["status_atual"], em: string) => [
    { id: "h", projeto_id: "p1", status_de: "CADASTRO INICIAL" as const, status_para: status, alterado_em: em, origem: "kanban" as const },
  ];

  it("1. PROJETO FINAL ENVIADO há 6 dias NÃO é SLA estourado e não tem meta", () => {
    const p = withStatusEntered("PROJETO FINAL ENVIADO", "2026-06-25");
    const kpis = computeOperationalKpis(p, history("PROJETO FINAL ENVIADO", "2026-06-25"), "2026-07-01");
    expect(kpis.diasNoStatusAtual).toBe(6);
    expect(kpis.hasSla).toBe(false);
    expect(kpis.slaTargetDias).toBeNull();
    expect(kpis.slaRestanteDias).toBeNull();
    expect(kpis.slaState).toBe("ok");
  });

  it("PROJETO FINAL ENVIADO nunca é isOverdue, mesmo com deadline importado no passado", () => {
    const p = withStatusEntered("PROJETO FINAL ENVIADO", "2026-06-25", { deadline: "2026-01-01" });
    const dl = getCurrentStatusDeadline(p, "2026-07-01");
    expect(dl.isOverdue).toBe(false);
    expect(dl.hasDeadline).toBe(false);
  });

  it("2/3/4/5. status sem SLA de dev não retornam atraso (isOverdue=false)", () => {
    for (const status of [
      "CADASTRO INICIAL", "ANTE-PROJETO ENVIADO", "ANTE-PROJETO APROVADO",
      "PROJETO FINAL ENVIADO", "PROJETO APROVADO",
    ] as Project["status_atual"][]) {
      const p = withStatusEntered(status, "2026-01-01", { deadline: "2026-01-05" });
      expect(getCurrentStatusDeadline(p, "2026-07-01").isOverdue).toBe(false);
    }
  });

  it("6. ELABORAR ANTE-PROJETO acima de 45 dias continua atrasado", () => {
    const p = withStatusEntered("ELABORAR ANTE-PROJETO", "2026-05-01");
    // 45 dias após 01/05 = 15/06; em 01/07 já passou.
    const dl = getCurrentStatusDeadline(p, "2026-07-01");
    expect(dl.isOverdue).toBe(true);
    expect(dl.hasDeadline).toBe(true);
  });

  it("7. REVISAO DE ESTUDO acima de 20 dias continua atrasado", () => {
    const p = withStatusEntered("REVISAO DE ESTUDO", "2026-05-01");
    // 20 dias após 01/05 = 21/05; em 01/07 já passou.
    expect(getCurrentStatusDeadline(p, "2026-07-01").isOverdue).toBe(true);
  });

  it("8. REVISAO DE PROJETO FINAL acima de 20 dias continua atrasado", () => {
    const p = withStatusEntered("REVISAO DE PROJETO FINAL", "2026-05-01");
    expect(getCurrentStatusDeadline(p, "2026-07-01").isOverdue).toBe(true);
  });

  it("9. urgência não transforma status sem SLA em atraso operacional", () => {
    const p = withStatusEntered("PROJETO FINAL ENVIADO", "2026-06-25", {
      urgente: true, urgentDeadline: "2026-06-26",
    });
    // Mesmo urgente e com urgentDeadline vencido, não há atraso por SLA de dev.
    expect(getCurrentStatusDeadline(p, "2026-07-01").isOverdue).toBe(false);
  });

  it("KPI 'Atrasados' (isOverdue) só conta status com SLA de desenvolvimento", () => {
    const today = "2026-07-01";
    const projects = [
      withStatusEntered("ELABORAR ANTE-PROJETO", "2026-05-01"),        // >45d → atrasado
      withStatusEntered("REVISAO DE ESTUDO", "2026-05-01"),            // >20d → atrasado
      withStatusEntered("REVISAO DE PROJETO FINAL", "2026-05-01"),     // >20d → atrasado
      withStatusEntered("PROJETO FINAL ENVIADO", "2026-01-01", { deadline: "2026-01-05" }), // NÃO
      withStatusEntered("PROJETO APROVADO", "2026-01-01", { deadline: "2026-01-05" }),      // NÃO
      withStatusEntered("ANTE-PROJETO ENVIADO", "2026-01-01", { deadline: "2026-01-05" }),  // NÃO
    ];
    const atrasados = projects.filter((p) => getCurrentStatusDeadline(p, today).isOverdue).length;
    expect(atrasados).toBe(3);
  });
});

describe("isOperationalStatus — PROJETO APROVADO é terminal (fora de KPIs operacionais)", () => {
  it("exclui PROJETO APROVADO dos status operacionais", () => {
    expect(isOperationalStatus("PROJETO APROVADO")).toBe(false);
    expect(OPERATIONAL_ACTIVE_STATUSES).not.toContain("PROJETO APROVADO");
  });

  it("inclui os demais status (cadastro, dev, revisões, enviados)", () => {
    const operacionais = [
      "CADASTRO INICIAL",
      "ELABORAR ANTE-PROJETO",
      "ANTE-PROJETO ENVIADO",
      "ANTE-PROJETO APROVADO",
      "PROJETO FINAL ENVIADO",
      "REVISAO DE ESTUDO",
      "REVISAO DE PROJETO FINAL",
    ] as const;
    for (const status of operacionais) {
      expect(isOperationalStatus(status)).toBe(true);
    }
  });
});
