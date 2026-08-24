// ANTE-PROJETO APROVADO: ordenação por DATA DE ENTRADA no status.
//
// A coluna não tem SLA/prazo, então ordena por `status_entered_at` — espelho de
// Project.currentStatusEnteredAt, gravado na MESMA transação e com o MESMO
// timestamp do registro em ProjectStatusHistory. Nunca por createdAt/updatedAt/
// data de lançamento/código.

import { describe, expect, it } from "vitest";
import {
  sortProjectsByStatusEntry,
  STATUS_ENTRY_SORTED_COLUMNS,
  DEFAULT_STATUS_ENTRY_SORT_MODE,
} from "@/features/projects/domain/project-rules";
import type { Project } from "@/features/projects/domain/project-types";

const ONTEM = "2026-07-20T09:00:00.000Z";
const HOJE = "2026-07-21T09:00:00.000Z";

function aprovado(overrides: Partial<Project> = {}): Project {
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
    status_atual: "ANTE-PROJETO APROVADO",
    status_entered_at: HOJE,
    data_envio: null,
    data_aprovacao: null,
    urgente: false,
    reviewCount: 0,
    finalReviewCount: 0,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

const ids = (list: Project[]) => list.map((p) => p.id);

describe("sortProjectsByStatusEntry — configuração da coluna", () => {
  it("ANTE-PROJETO APROVADO está registrada como ordenada por entrada", () => {
    expect(STATUS_ENTRY_SORTED_COLUMNS).toContain("ANTE-PROJETO APROVADO");
  });

  it("o modo padrão é entrada mais recente primeiro", () => {
    expect(DEFAULT_STATUS_ENTRY_SORT_MODE).toBe("entryNewest");
  });
});

// Caso 1 — projeto entrou ontem e outro hoje.
describe("sortProjectsByStatusEntry — ontem vs hoje", () => {
  it("entryNewest: quem entrou hoje vem antes de quem entrou ontem", () => {
    const ontem = aprovado({ id: "ontem", status_entered_at: ONTEM });
    const hoje = aprovado({ id: "hoje", status_entered_at: HOJE });
    expect(ids(sortProjectsByStatusEntry([ontem, hoje], "entryNewest"))).toEqual(["hoje", "ontem"]);
  });

  it("entryOldest: quem entrou ontem vem antes de quem entrou hoje", () => {
    const ontem = aprovado({ id: "ontem", status_entered_at: ONTEM });
    const hoje = aprovado({ id: "hoje", status_entered_at: HOJE });
    expect(ids(sortProjectsByStatusEntry([hoje, ontem], "entryOldest"))).toEqual(["ontem", "hoje"]);
  });

  it("sem modo explícito usa o padrão (mais recentes primeiro)", () => {
    const ontem = aprovado({ id: "ontem", status_entered_at: ONTEM });
    const hoje = aprovado({ id: "hoje", status_entered_at: HOJE });
    expect(ids(sortProjectsByStatusEntry([ontem, hoje]))).toEqual(["hoje", "ontem"]);
  });
});

// Caso 2 — projeto que entrou duas vezes no status.
describe("sortProjectsByStatusEntry — reentrada no status", () => {
  it("usa a entrada MAIS RECENTE, não a primeira", () => {
    // "voltou": entrou em 01/07, saiu, e RETORNOU em 10/08 → status_entered_at = 10/08.
    const voltou = aprovado({ id: "voltou", status_entered_at: "2026-08-10T12:00:00.000Z" });
    // "unico": entrou uma única vez em 05/08 — depois da 1ª entrada do outro, antes do retorno.
    const unico = aprovado({ id: "unico", status_entered_at: "2026-08-05T12:00:00.000Z" });

    // Se usasse a PRIMEIRA entrada (01/07), "voltou" viria por último em entryNewest.
    expect(ids(sortProjectsByStatusEntry([unico, voltou], "entryNewest"))).toEqual([
      "voltou",
      "unico",
    ]);
    expect(ids(sortProjectsByStatusEntry([voltou, unico], "entryOldest"))).toEqual([
      "unico",
      "voltou",
    ]);
  });
});

// Caso 3 — observação/urgência/lembrete não podem mover o card.
describe("sortProjectsByStatusEntry — urgência e observações não afetam a ordem", () => {
  it("urgência NÃO promove o card ao topo", () => {
    const antigoUrgente = aprovado({ id: "antigo", status_entered_at: ONTEM, urgente: true });
    const recente = aprovado({ id: "recente", status_entered_at: HOJE });
    expect(ids(sortProjectsByStatusEntry([antigoUrgente, recente], "entryNewest"))).toEqual([
      "recente",
      "antigo",
    ]);
  });

  it("marcar urgência (prazo/motivo) não altera a ordem por entrada", () => {
    const a = aprovado({ id: "a", status_entered_at: ONTEM });
    const b = aprovado({ id: "b", status_entered_at: HOJE });
    const antes = ids(sortProjectsByStatusEntry([a, b], "entryNewest"));

    const aMarcado: Project = {
      ...a,
      urgente: true,
      urgentDeadline: "2026-07-25",
      urgentReason: "pedido do cliente",
    };
    const depois = ids(sortProjectsByStatusEntry([aMarcado, b], "entryNewest"));

    expect(depois).toEqual(antes);
  });
});

// Caso 4 — updatedAt / createdAt / lançamento não interferem.
describe("sortProjectsByStatusEntry — ignora updated_at, created_at e lançamento", () => {
  it("updated_at muito mais novo NÃO promove o card", () => {
    const antigoEntrou = aprovado({
      id: "antigo",
      status_entered_at: ONTEM,
      updated_at: "2099-12-31T23:59:59.000Z",
      created_at: "2099-12-31T23:59:59.000Z",
    });
    const recenteEntrou = aprovado({
      id: "recente",
      status_entered_at: HOJE,
      updated_at: "2000-01-01T00:00:00.000Z",
      created_at: "2000-01-01T00:00:00.000Z",
    });
    // Se usasse updated_at, "antigo" viria primeiro. Não vem.
    expect(ids(sortProjectsByStatusEntry([antigoEntrou, recenteEntrou], "entryNewest"))).toEqual([
      "recente",
      "antigo",
    ]);
  });

  it("data de lançamento não interfere", () => {
    const a = aprovado({ id: "a", status_entered_at: ONTEM, data_lancamento: "2026-01-01" });
    const b = aprovado({ id: "b", status_entered_at: HOJE, data_lancamento: "2020-01-01" });
    expect(ids(sortProjectsByStatusEntry([a, b], "entryNewest"))).toEqual(["b", "a"]);
  });
});

// Caso 5 — legado sem data de entrada: determinístico, sem inventar data.
describe("sortProjectsByStatusEntry — projetos sem data de entrada (legado)", () => {
  it("vai para o FIM nos dois modos", () => {
    const semData = aprovado({ id: "sem", status_entered_at: "" });
    const comData = aprovado({ id: "com", status_entered_at: HOJE });

    expect(ids(sortProjectsByStatusEntry([semData, comData], "entryNewest"))).toEqual([
      "com",
      "sem",
    ]);
    expect(ids(sortProjectsByStatusEntry([semData, comData], "entryOldest"))).toEqual([
      "com",
      "sem",
    ]);
  });

  it("data inválida é tratada como ausente (fim), sem inventar valor", () => {
    const invalida = aprovado({ id: "invalida", status_entered_at: "data-quebrada" });
    const valida = aprovado({ id: "valida", status_entered_at: ONTEM });
    expect(ids(sortProjectsByStatusEntry([invalida, valida], "entryNewest"))).toEqual([
      "valida",
      "invalida",
    ]);
    expect(ids(sortProjectsByStatusEntry([invalida, valida], "entryOldest"))).toEqual([
      "valida",
      "invalida",
    ]);
  });

  it("vários sem data preservam a ordem de entrada (estável/determinístico)", () => {
    const s1 = aprovado({ id: "s1", status_entered_at: "" });
    const s2 = aprovado({ id: "s2", status_entered_at: "" });
    const com = aprovado({ id: "com", status_entered_at: HOJE });
    expect(ids(sortProjectsByStatusEntry([s1, com, s2], "entryNewest"))).toEqual([
      "com",
      "s1",
      "s2",
    ]);
  });
});

describe("sortProjectsByStatusEntry — robustez", () => {
  it("empate no mesmo instante preserva a ordem de entrada (sort estável)", () => {
    const a = aprovado({ id: "a", status_entered_at: HOJE });
    const b = aprovado({ id: "b", status_entered_at: HOJE });
    expect(ids(sortProjectsByStatusEntry([a, b], "entryNewest"))).toEqual(["a", "b"]);
    expect(ids(sortProjectsByStatusEntry([b, a], "entryOldest"))).toEqual(["b", "a"]);
  });

  it("não muta o array recebido", () => {
    const a = aprovado({ id: "a", status_entered_at: ONTEM });
    const b = aprovado({ id: "b", status_entered_at: HOJE });
    const entrada = [a, b];
    sortProjectsByStatusEntry(entrada, "entryNewest");
    expect(ids(entrada)).toEqual(["a", "b"]);
  });

  it("lista vazia e lista unitária não quebram", () => {
    expect(sortProjectsByStatusEntry([], "entryNewest")).toEqual([]);
    const so = aprovado({ id: "so", status_entered_at: HOJE });
    expect(ids(sortProjectsByStatusEntry([so], "entryOldest"))).toEqual(["so"]);
  });
});
