import { describe, expect, it } from "vitest";
import {
  finalSequenceSuffix,
  hasValidFinalCode,
  highestFinalCode,
  suggestFinalCodeFromSent,
} from "@/features/projects/domain/project-code";

// Regra: a entrada é SOMENTE a lista de códigos dos projetos cujo status ATUAL é
// PROJETO FINAL ENVIADO. Quem saiu de PF ENVIADO simplesmente não está na lista.
const next = (sent: string[], current = "CRE-NOV-0000") => suggestFinalCodeFromSent(sent, current);

describe("sugestão do código final — só PROJETO FINAL ENVIADO", () => {
  it("normal: 2158, 2159, 2160 → 2161", () => {
    const r = next(["CRE-AAA-2158", "CRE-BBB-2159", "CRE-POM-2160"]);
    expect(r.lastFinalCode).toBe("CRE-POM-2160");
    expect(r.maxSuffix).toBe(2160);
    expect(r.suggestedFinalCode).toBe("CRE-POM-2161");
  });

  it("maior sufixo, não a ordem da lista: 2159, 2160, 2157 → 2161", () => {
    expect(next(["CRE-AAA-2159", "CRE-BBB-2160", "CRE-CCC-2157"]).suggestedFinalCode).toBe("CRE-BBB-2161");
  });

  it("aprovação (desejado): 2160 saiu para PROJETO APROVADO, PF máximo = 2159 → 2160", () => {
    expect(next(["CRE-AAA-2158", "CRE-BBB-2159"]).suggestedFinalCode).toBe("CRE-BBB-2160");
  });

  it("revisão (desejado): 2159 saiu para REVISÃO DE PF, PF máximo = 2158 → 2159", () => {
    expect(next(["CRE-AAA-2158"]).suggestedFinalCode).toBe("CRE-AAA-2159");
  });

  it("regressão: 2199 regredido não está mais em PF; PF máximo = 2160 → 2161 (não 2200)", () => {
    const r = next(["CRE-AAA-2158", "CRE-POM-2160"]);
    expect(r.suggestedFinalCode).toBe("CRE-POM-2161");
    expect(r.suggestedFinalCode).not.toContain("2200");
  });

  it("códigos inválidos são ignorados: 21ZZ, 1864R1 e 3 dígitos", () => {
    const r = next(["CRE-XXX-21ZZ", "CRE-ABC-1864R1", "CRE-POÇ-139", "CRE-AAA-2160"]);
    expect(r.lastFinalCode).toBe("CRE-AAA-2160");
    expect(r.suggestedFinalCode).toBe("CRE-AAA-2161");
  });

  it("sufixo da sequência: hífen + EXATAMENTE 4 dígitos no fim", () => {
    expect(finalSequenceSuffix("CRE-POM-2160")).toBe(2160);
    expect(finalSequenceSuffix("CRE-ABC-0001")).toBe(1);
    expect(finalSequenceSuffix("  CRE-POM-2160  ")).toBe(2160);
    for (const bad of ["CRE-BGP-15111", "CRE-XXX-21ZZ", "CRE-ABC-1864R1", "CRE-ABC-X2160", "CRE-ABC-216", "2160", ""]) {
      expect(finalSequenceSuffix(bad), bad).toBeNull();
    }
  });

  it("5 dígitos é ignorado: 2160 e 15111 → 2161", () => {
    expect(next(["CRE-AAA-2160", "CRE-BBB-15111"]).suggestedFinalCode).toBe("CRE-AAA-2161");
  });

  it("letra antes dos dígitos é ignorada: X9999 e 2160 → 2161", () => {
    expect(next(["CRE-AAA-X9999", "CRE-BBB-2160"]).suggestedFinalCode).toBe("CRE-BBB-2161");
  });

  it("3 dígitos é ignorado: 216 e 2160 → 2161", () => {
    expect(next(["CRE-AAA-216", "CRE-BBB-2160"]).suggestedFinalCode).toBe("CRE-BBB-2161");
  });

  it("só 15111, 21ZZ e 1864R1: sem código válido → código atual/provisório", () => {
    expect(next(["CRE-AAA-15111", "CRE-BBB-21ZZ", "CRE-CCC-1864R1"], "CRE-TMP-0042")).toEqual({
      lastFinalCode: null,
      maxSuffix: null,
      suggestedFinalCode: "CRE-TMP-0042",
    });
  });

  it("hasValidFinalCode (validação do modal/servidor) continua igual: aceita 4+ dígitos", () => {
    expect(hasValidFinalCode("CRE-BGP-15111")).toBe(true);
    expect(hasValidFinalCode("CRE-ABC-X2160")).toBe(true);
    expect(hasValidFinalCode("CRE-ABC-216")).toBe(false);
  });

  it("R1 não vira sufixo 1 nem vence um código válido menor", () => {
    expect(highestFinalCode(["CRE-ABC-1864R1"])).toBeNull();
    expect(highestFinalCode(["CRE-ABC-1864R1", "CRE-AAA-0005"])).toEqual({ code: "CRE-AAA-0005", suffix: 5 });
  });

  it("sem nenhum código válido: não calcula sequência, devolve o código atual/provisório", () => {
    const r = next(["CRE-XXX-21ZZ", "CRE-ABC-1864R1"], "CRE-TMP-0042");
    expect(r).toEqual({ lastFinalCode: null, maxSuffix: null, suggestedFinalCode: "CRE-TMP-0042" });
  });

  it("PF ENVIADO vazio: devolve o código atual (sem inventar sequência)", () => {
    expect(next([], "  CRE-NOV-ABCD  ").suggestedFinalCode).toBe("CRE-NOV-ABCD");
    expect(next([], "").suggestedFinalCode).toBeNull();
  });

  it("prefixos diferentes: AAA-AAA-2159 e BBB-BBB-2160 → sufixo 2161 (prefixo do maior, como antes)", () => {
    const r = next(["AAA-AAA-2159", "BBB-BBB-2160"]);
    expect(r.maxSuffix).toBe(2160);
    expect(r.suggestedFinalCode).toBe("BBB-BBB-2161");
  });

  it("o código atual do projeto movido não influencia a numeração", () => {
    expect(next(["CRE-POM-2160"], "CRE-TMP-9999").suggestedFinalCode).toBe("CRE-POM-2161");
  });
});
