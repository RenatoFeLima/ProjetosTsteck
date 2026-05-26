import { describe, expect, it } from "vitest";
import {
  applyAlignmentAutomation,
  computePrazoBadge,
  computePrazoEntrega,
  transitionStatus,
} from "@/features/projects/domain/project-rules";

describe("project rules", () => {
  it("calcula prazo de entrega com +45 dias", () => {
    expect(computePrazoEntrega("2026-05-01")).toBe("2026-06-15");
  });

  it("recalcula prazo quando data alinhamento muda", () => {
    const oldPrazo = computePrazoEntrega("2026-05-01");
    const newPrazo = computePrazoEntrega("2026-05-10");
    expect(oldPrazo).toBe("2026-06-15");
    expect(newPrazo).toBe("2026-06-24");
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
});
