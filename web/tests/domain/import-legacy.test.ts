import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvToObjects } from "@/features/import/domain/csv";
import {
  normalizeName,
  normalizeCode,
  parseBoolPt,
  cleanEngineerName,
  parseDateBr,
} from "@/features/import/domain/import-normalize";
import { mapAnteStatus, cadastroInitialStatus } from "@/features/import/domain/legacy-mapping";

describe("CSV parser", () => {
  it("faz parse de campos com aspas, vírgula e quebra de linha internas", () => {
    const text = 'a,b,c\r\n1,"x,y","linha\n2"\r\n';
    const rows = parseCsv(text);
    expect(rows[0]).toEqual(["a", "b", "c"]);
    expect(rows[1]).toEqual(["1", "x,y", "linha\n2"]);
  });

  it("remove BOM, ignora cabeçalhos vazios e linhas vazias", () => {
    const text = "﻿CONSTRUTORA,OBRA,,\nACME,Torre A,,\n,,,\n";
    const objs = parseCsvToObjects(text);
    expect(objs).toHaveLength(1);
    expect(objs[0]).toEqual({ CONSTRUTORA: "ACME", OBRA: "Torre A" });
  });

  it("trima cabeçalhos com espaço à direita (ex.: 'OBRA ')", () => {
    const objs = parseCsvToObjects("CONSTRUTORA,OBRA ,ALINHAMENTO \nX,Y,VERDADEIRO\n");
    expect(objs[0].OBRA).toBe("Y");
    expect(objs[0].ALINHAMENTO).toBe("VERDADEIRO");
  });
});

describe("normalização", () => {
  it("normaliza nome (acentos, caixa, espaços)", () => {
    expect(normalizeName("  AFONSO   FRANÇA ")).toBe("afonso franca");
    expect(normalizeName("Diálogo")).toBe("dialogo");
    expect(normalizeName("DIALOGO")).toBe(normalizeName("diálogo"));
  });

  it("normaliza código de equipamento", () => {
    expect(normalizeCode(" ek-15/26 ")).toBe("EK-15/26");
  });

  it("interpreta VERDADEIRO/FALSO", () => {
    expect(parseBoolPt("VERDADEIRO")).toBe(true);
    expect(parseBoolPt("falso")).toBe(false);
    expect(parseBoolPt("")).toBe(false);
    expect(parseBoolPt("talvez")).toBeUndefined();
  });

  it("limpa o prefixo ENG. do engenheiro", () => {
    expect(cleanEngineerName("ENG. DANIEL MELICE")).toBe("DANIEL MELICE");
    expect(cleanEngineerName("ENG DANIEL")).toBe("DANIEL");
    expect(cleanEngineerName("DANIEL")).toBe("DANIEL");
  });
});

describe("datas dd/MM (assumir BR)", () => {
  it("faz parse de dd/MM/yyyy e dd/MM/yy", () => {
    const a = parseDateBr("22/01/2026");
    expect(a.ok && a.date?.toISOString().slice(0, 10)).toBe("2026-01-22");
    const b = parseDateBr("07/11/2025");
    expect(b.ok && b.date?.toISOString().slice(0, 10)).toBe("2025-11-07");
  });

  it("vazio retorna ok com date null", () => {
    const r = parseDateBr("");
    expect(r).toEqual({ ok: true, date: null });
  });

  it("formato US (mês > 12) vira erro", () => {
    const r = parseDateBr("10/29/2025");
    expect(r.ok).toBe(false);
  });

  it("data impossível (31/02) vira erro", () => {
    expect(parseDateBr("31/02/2025").ok).toBe(false);
  });
});

describe("mapeamento de status", () => {
  it("mapeia status do ante-projeto", () => {
    expect(mapAnteStatus("PROJETO FINAL ENVIADO")).toMatchObject({ ok: true, status: "PROJETO_FINAL_ENVIADO" });
    expect(mapAnteStatus("Revisão de Estudo")).toMatchObject({ ok: true, status: "REVISAO_DE_ESTUDO" });
  });

  it("URGENTE! assume ELABORAR + urgente", () => {
    expect(mapAnteStatus("URGENTE!")).toMatchObject({ ok: true, status: "ELABORAR_ANTE_PROJETO", urgente: true, assumed: true });
  });

  it("status desconhecido falha", () => {
    expect(mapAnteStatus("QUALQUER COISA").ok).toBe(false);
  });

  it("status inicial do cadastro depende das 3 flags", () => {
    expect(cadastroInitialStatus(true, true, true)).toBe("ELABORAR_ANTE_PROJETO");
    expect(cadastroInitialStatus(true, true, false)).toBe("CADASTRO_INICIAL");
    expect(cadastroInitialStatus(false, false, false)).toBe("CADASTRO_INICIAL");
  });
});
