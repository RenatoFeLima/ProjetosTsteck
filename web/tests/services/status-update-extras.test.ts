// @vitest-environment node
// statusUpdateExtras é pura (sem prisma), mas vive em projectService.ts que
// importa @/lib/db/prisma — por isso rodamos em node (não jsdom). Nenhuma query
// é executada: a função só monta o objeto de update.
import { describe, expect, it } from "vitest";
import { statusUpdateExtras } from "@/server/services/projectService";

describe("statusUpdateExtras (Regra 2 backend — limpeza de urgência)", () => {
  it("6. ANTE_PROJETO_ENVIADO limpa priority, urgentDeadline e urgentReason", () => {
    const extras = statusUpdateExtras("ANTE_PROJETO_ENVIADO");
    expect(extras.priority).toBe("NORMAL");
    expect(extras.urgentDeadline).toBeNull();
    expect(extras.urgentReason).toBeNull();
  });

  it("PROJETO_APROVADO zera prioridade (não precisa limpar prazo/motivo)", () => {
    const extras = statusUpdateExtras("PROJETO_APROVADO");
    expect(extras.priority).toBe("NORMAL");
  });

  it("REVISAO_DE_ESTUDO incrementa o contador de revisão e NÃO mexe na urgência", () => {
    const extras = statusUpdateExtras("REVISAO_DE_ESTUDO");
    expect(extras.reviewStudyCount).toEqual({ increment: 1 });
    expect(extras.priority).toBeUndefined();
    expect(extras.urgentDeadline).toBeUndefined();
    expect(extras.urgentReason).toBeUndefined();
  });

  it("REVISAO_DE_PROJETO_FINAL incrementa o contador final e não mexe na urgência", () => {
    const extras = statusUpdateExtras("REVISAO_DE_PROJETO_FINAL");
    expect(extras.finalReviewCount).toEqual({ increment: 1 });
    expect(extras.priority).toBeUndefined();
  });

  it("ELABORAR_ANTE_PROJETO não tem efeitos colaterais (preserva urgência)", () => {
    const extras = statusUpdateExtras("ELABORAR_ANTE_PROJETO");
    expect(extras.priority).toBeUndefined();
    expect(extras.urgentDeadline).toBeUndefined();
    expect(extras.urgentReason).toBeUndefined();
    expect(extras.reviewStudyCount).toBeUndefined();
  });
});
