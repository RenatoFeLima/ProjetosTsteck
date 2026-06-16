import { describe, expect, it } from "vitest";
import {
  extractCodeSuffix,
  extractCodePrefix,
  maxCodeSuffix,
  suggestNextCode,
  padSuffix,
  hasValidFinalCode,
} from "@/features/projects/domain/project-code";

describe("código do projeto", () => {
  it("extrai sufixo e prefixo", () => {
    expect(extractCodeSuffix("CRE-POÇ-0000")).toBe(0);
    expect(extractCodeSuffix("CRE-CYR-0012")).toBe(12);
    expect(extractCodePrefix("CRE-POÇ-0000")).toBe("CRE-POÇ");
    expect(extractCodeSuffix("SEM-NUMERO")).toBeNull();
  });

  it("maior sufixo GLOBAL ignora prefixos diferentes", () => {
    expect(maxCodeSuffix(["CRE-POÇ-0000", "CRE-CYR-0001", "CRE-PLA-0002"])).toBe(2);
    expect(maxCodeSuffix([])).toBe(0);
    expect(maxCodeSuffix(["SEM-NUMERO"])).toBe(0);
  });

  it("sugere o próximo código preservando o prefixo, com padding de 4", () => {
    expect(suggestNextCode("CRE-POÇ-0000", 0)).toBe("CRE-POÇ-0001");
    expect(suggestNextCode("CRE-CYR-0001", 1)).toBe("CRE-CYR-0002");
    // prefixo diferente segue a mesma sequência global
    expect(suggestNextCode("CRE-PLA-0000", 2)).toBe("CRE-PLA-0003");
    expect(suggestNextCode("X-9", 9)).toBe("X-0010");
  });

  it("padding sempre com 4 dígitos", () => {
    expect(padSuffix(1)).toBe("0001");
    expect(padSuffix(12)).toBe("0012");
    expect(padSuffix(123)).toBe("0123");
    expect(padSuffix(12345)).toBe("12345");
  });

  it("valida que o código final termina com 4 dígitos numéricos", () => {
    expect(hasValidFinalCode("CRE-POÇ-0001")).toBe(true);
    expect(hasValidFinalCode("CRE-POÇ-1")).toBe(false);
    expect(hasValidFinalCode("ABC")).toBe(false);
  });
});
