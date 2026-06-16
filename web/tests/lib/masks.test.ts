import { describe, expect, it } from "vitest";
import { formatCnpj, formatPhoneBR, isValidCnpj, onlyDigits } from "@/features/master-data/lib/masks";

describe("máscaras de cadastro", () => {
  it("formata CNPJ progressivamente", () => {
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCnpj("112")).toBe("11.2");
    expect(formatCnpj("")).toBe("");
  });

  it("formatCnpj é idempotente (dados antigos já formatados)", () => {
    expect(formatCnpj("11.222.333/0001-81")).toBe("11.222.333/0001-81");
  });

  it("formata telefone fixo e celular", () => {
    expect(formatPhoneBR("11999998888")).toBe("(11) 99999-8888");
    expect(formatPhoneBR("1133334444")).toBe("(11) 3333-4444");
    expect(formatPhoneBR("")).toBe("");
  });

  it("valida CNPJ (dígitos verificadores)", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-99")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCnpj("123")).toBe(false);
  });

  it("onlyDigits remove a formatação (salvar apenas dígitos)", () => {
    expect(onlyDigits("11.222.333/0001-81")).toBe("11222333000181");
    expect(onlyDigits("(11) 99999-8888")).toBe("11999998888");
    expect(onlyDigits(null)).toBe("");
  });
});
