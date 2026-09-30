import { describe, expect, it } from "vitest";
import {
  ADMIN_REGRESSION_SOURCE,
  getRegressionTargets,
  isRegressionTarget,
  normalizeRegressionReason,
  regressionResetsAlignment,
} from "@/features/projects/domain/status-regression";
import { calculateProductionMetrics } from "@/features/projects/domain/production-metrics";
import { getAllowedStatusTransitions } from "@/features/projects/domain/project-rules";
import { PROJECT_STATUSES, type ProjectStatus, type StatusHistoryItem } from "@/features/projects/domain/project-types";

// Mapa aprovado (diagnóstico, seção 5). Revisões nunca são destino.
const APPROVED_MAP: Record<ProjectStatus, ProjectStatus[]> = {
  "CADASTRO INICIAL": [],
  "ELABORAR ANTE-PROJETO": ["CADASTRO INICIAL"],
  "ANTE-PROJETO ENVIADO": ["CADASTRO INICIAL", "ELABORAR ANTE-PROJETO"],
  "REVISAO DE ESTUDO": ["CADASTRO INICIAL", "ELABORAR ANTE-PROJETO"],
  "ANTE-PROJETO APROVADO": ["CADASTRO INICIAL", "ELABORAR ANTE-PROJETO", "ANTE-PROJETO ENVIADO"],
  "PROJETO FINAL ENVIADO": ["CADASTRO INICIAL", "ELABORAR ANTE-PROJETO", "ANTE-PROJETO ENVIADO", "ANTE-PROJETO APROVADO"],
  "REVISAO DE PROJETO FINAL": ["CADASTRO INICIAL", "ELABORAR ANTE-PROJETO", "ANTE-PROJETO ENVIADO", "ANTE-PROJETO APROVADO"],
  "PROJETO APROVADO": [
    "CADASTRO INICIAL",
    "ELABORAR ANTE-PROJETO",
    "ANTE-PROJETO ENVIADO",
    "ANTE-PROJETO APROVADO",
    "PROJETO FINAL ENVIADO",
  ],
};

describe("getRegressionTargets — mapa aprovado", () => {
  it.each(PROJECT_STATUSES.map((s) => [s]))("%s", (status) => {
    expect(getRegressionTargets(status)).toEqual(APPROVED_MAP[status]);
  });

  it.each(PROJECT_STATUSES.map((s) => [s]))("%s: nunca o próprio status, nunca uma revisão", (status) => {
    const targets = getRegressionTargets(status);
    expect(targets).not.toContain(status);
    expect(targets).not.toContain("REVISAO DE ESTUDO");
    expect(targets).not.toContain("REVISAO DE PROJETO FINAL");
  });

  it("nenhum destino de regressão é um destino do fluxo normal (não substitui avanço nem reenvio)", () => {
    for (const status of PROJECT_STATUSES) {
      const normal = getAllowedStatusTransitions(status);
      for (const target of getRegressionTargets(status)) expect(normal).not.toContain(target);
    }
  });

  it("status futuro não é destino", () => {
    expect(isRegressionTarget("ANTE-PROJETO ENVIADO", "PROJETO APROVADO")).toBe(false);
    expect(isRegressionTarget("ANTE-PROJETO APROVADO", "PROJETO FINAL ENVIADO")).toBe(false);
    expect(isRegressionTarget("PROJETO APROVADO", "ANTE-PROJETO ENVIADO")).toBe(true);
  });

  it("retorna cópia (mutar o resultado não altera o mapa)", () => {
    getRegressionTargets("PROJETO APROVADO").push("PROJETO APROVADO");
    expect(getRegressionTargets("PROJETO APROVADO")).not.toContain("PROJETO APROVADO");
  });
});

describe("normalizeRegressionReason", () => {
  it.each([
    ["vazio", ""],
    ["só espaços", "     "],
    ["4 caracteres após trim", "  abcd  "],
    ["501 caracteres", "a".repeat(501)],
    ["não é texto", 42],
    ["ausente", undefined],
  ])("recusa %s", (_label, input) => {
    expect(normalizeRegressionReason(input).ok).toBe(false);
  });

  it("aceita os limites e devolve o texto sem espaços nas pontas", () => {
    expect(normalizeRegressionReason("  abcde  ")).toEqual({ ok: true, reason: "abcde" });
    expect(normalizeRegressionReason("a".repeat(500)).ok).toBe(true);
  });
});

describe("regressionResetsAlignment", () => {
  it("só Cadastro Inicial desmarca o alinhamento", () => {
    for (const status of PROJECT_STATUSES) {
      expect(regressionResetsAlignment(status)).toBe(status === "CADASTRO INICIAL");
    }
  });
});

describe("production metrics — regressão administrativa não é produção", () => {
  function event(id: string, to: ProjectStatus, origem: StatusHistoryItem["origem"], day = "2026-06-10"): StatusHistoryItem {
    return { id, projeto_id: `p-${id}`, status_de: null, status_para: to, alterado_em: `${day}T12:00:00.000Z`, origem };
  }

  it.each(["ANTE-PROJETO ENVIADO", "PROJETO FINAL ENVIADO", "PROJETO APROVADO"] as ProjectStatus[])(
    "evento admin_regression para %s não conta",
    (to) => {
      const m = calculateProductionMetrics([event("r", to, ADMIN_REGRESSION_SOURCE)], "2026-06-01", "2026-06-30");
      expect(m).toEqual({
        anteProjetosEnviados: 0,
        anteProjetosUnicos: 0,
        projetosFiaisEnviados: 0,
        projetosFiaisUnicos: 0,
        projetosAprovados: 0,
        projetosAprovadosUnicos: 0,
      });
    },
  );

  it("eventos normais continuam contando, mesmo misturados a regressões", () => {
    const m = calculateProductionMetrics(
      [
        event("a", "ANTE-PROJETO ENVIADO", "kanban"),
        event("b", "PROJETO FINAL ENVIADO", "acao-rapida"),
        event("c", "PROJETO APROVADO", "kanban"),
        event("r1", "ANTE-PROJETO ENVIADO", ADMIN_REGRESSION_SOURCE),
        event("r2", "PROJETO FINAL ENVIADO", ADMIN_REGRESSION_SOURCE),
      ],
      "2026-06-01",
      "2026-06-30",
    );
    expect(m.anteProjetosEnviados).toBe(1);
    expect(m.projetosFiaisEnviados).toBe(1);
    expect(m.projetosAprovados).toBe(1);
  });
});
