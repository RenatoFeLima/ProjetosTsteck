import { describe, expect, it } from "vitest";
import { formatDateTimeBR, formatDateBR } from "@/lib/mail/format-datetime";

describe("formatação de data/hora em Brasília", () => {
  it("converte UTC para o fuso de Brasília (dd/MM/yyyy, HH:mm)", () => {
    // 14:01 UTC = 11:01 em São Paulo (UTC-3).
    expect(formatDateTimeBR("2026-06-10T14:01:00.000Z")).toBe("10/06/2026, 11:01");
  });

  it("usa 24h e não desloca o dia indevidamente", () => {
    // 02:30 UTC = 23:30 do dia anterior em São Paulo.
    expect(formatDateTimeBR("2026-06-10T02:30:00.000Z")).toBe("09/06/2026, 23:30");
  });

  it("formatDateBR mantém a data literal de strings yyyy-MM-dd (sem fuso)", () => {
    expect(formatDateBR("2026-06-14")).toBe("14/06/2026");
  });

  it("trata vazio/nulo", () => {
    expect(formatDateTimeBR(null)).toBe("");
    expect(formatDateBR(undefined)).toBe("");
  });
});
