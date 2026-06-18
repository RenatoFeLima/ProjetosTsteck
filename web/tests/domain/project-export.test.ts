import { describe, expect, it } from "vitest";
import {
  formatDateBr,
  formatBool,
  statusLabel,
  escapeCsvField,
  projectRowToCells,
  buildProjectsCsv,
  exportFileName,
  EXPORT_HEADERS,
  type ProjectExportRow,
} from "@/features/projects/domain/project-export";

function makeRow(over: Partial<ProjectExportRow> = {}): ProjectExportRow {
  return {
    id: "uuid-1",
    code: "CRE-RES-2051",
    status: "PROJETO_APROVADO",
    construtora: "EZTEC",
    obra: "RESERVA SÃO CAETANO",
    vendedor: "Carlos Romano",
    equipamento: "CH-20/30",
    tipoCabine: "SIMPLES",
    engenheiro: "Bruno Daga",
    telefone: "11970194111",
    dataLancamento: new Date("2026-01-15T00:00:00.000Z"),
    projetoObraRecebido: true,
    localCabineDefinido: false,
    alinhamentoConcluido: true,
    dataAlinhamento: null,
    urgente: false,
    prazoUrgencia: null,
    motivoUrgencia: null,
    prazoOperacional: null,
    createdAt: new Date("2026-01-10T00:00:00.000Z"),
    updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    qtdObservacoes: 2,
    ultimaObservacao: "posição na pasta",
    ...over,
  };
}

describe("project-export — formatadores", () => {
  it("4. datas em dd/mm/aaaa (Date e string ISO)", () => {
    expect(formatDateBr(new Date("2026-06-18T00:00:00.000Z"))).toBe("18/06/2026");
    expect(formatDateBr("2026-06-18T15:47:39.159Z")).toBe("18/06/2026");
    expect(formatDateBr("2026-06-18")).toBe("18/06/2026");
  });

  it("7. data vazia/nula/ inválida → string vazia (não quebra)", () => {
    expect(formatDateBr(null)).toBe("");
    expect(formatDateBr(undefined)).toBe("");
    expect(formatDateBr("")).toBe("");
    expect(formatDateBr("xx/yy")).toBe("");
  });

  it("5. booleanos como Sim/Não", () => {
    expect(formatBool(true)).toBe("Sim");
    expect(formatBool(false)).toBe("Não");
    expect(formatBool(null)).toBe("Não");
    expect(formatBool(undefined)).toBe("Não");
  });

  it("6. status com label amigável (enum → rótulo)", () => {
    expect(statusLabel("PROJETO_APROVADO")).toBe("PROJETO APROVADO");
    expect(statusLabel("ELABORAR_ANTE_PROJETO")).toBe("ELABORAR ANTE-PROJETO");
    // enum desconhecido cai para o próprio valor
    expect(statusLabel("DESCONHECIDO")).toBe("DESCONHECIDO");
  });

  it("escapa campos com separador, aspas e quebras de linha", () => {
    expect(escapeCsvField("simples")).toBe("simples");
    expect(escapeCsvField("a;b")).toBe('"a;b"');
    expect(escapeCsvField('diz "oi"')).toBe('"diz ""oi"""');
    expect(escapeCsvField("linha1\nlinha2")).toBe('"linha1\nlinha2"');
  });

  it("nome do arquivo com timestamp", () => {
    const name = exportFileName(new Date(2026, 5, 18, 15, 30), "csv");
    expect(name).toBe("projetos-tsteck-2026-06-18-1530.csv");
  });
});

describe("project-export — linha e CSV completo", () => {
  it("mapeia a linha na ordem das colunas, com formatação", () => {
    const cells = projectRowToCells(makeRow());
    expect(cells).toHaveLength(EXPORT_HEADERS.length);
    expect(cells[0]).toBe("uuid-1"); // ID do Projeto
    expect(cells[1]).toBe("CRE-RES-2051"); // Código
    expect(cells[2]).toBe("PROJETO APROVADO"); // Status (label)
    expect(cells[10]).toBe("15/01/2026"); // Data de Lançamento
    expect(cells[11]).toBe("Sim"); // Projeto de Obra Recebido
    expect(cells[12]).toBe("Não"); // Local da Cabine Definido
    expect(cells[15]).toBe("Não"); // Urgente
    expect(cells[21]).toBe("2"); // Qtd. Observações
  });

  it("7. campos vazios não quebram a exportação (linha completa, células vazias)", () => {
    const cells = projectRowToCells(
      makeRow({
        construtora: null, obra: null, vendedor: null, equipamento: null,
        tipoCabine: null, engenheiro: null, telefone: null, motivoUrgencia: null,
        dataLancamento: null, dataAlinhamento: null, ultimaObservacao: null,
      }),
    );
    expect(cells).toHaveLength(EXPORT_HEADERS.length);
    expect(cells[3]).toBe(""); // Construtora vazia
    expect(cells[10]).toBe(""); // Data vazia
  });

  it("3. exporta projetos de qualquer status e gera CSV com cabeçalho + BOM", () => {
    const rows = [
      makeRow({ id: "id-a", code: "A-1", status: "CADASTRO_INICIAL" }),
      makeRow({ id: "id-b", code: "B-2", status: "REVISAO_DE_ESTUDO" }),
      makeRow({ id: "id-c", code: "C-3", status: "PROJETO_FINAL_ENVIADO" }),
    ];
    const csv = buildProjectsCsv(rows);
    // BOM no início
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split("\r\n");
    // cabeçalho + 3 linhas
    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(EXPORT_HEADERS.join(";"));
    // ID do Projeto é a primeira coluna, antes do código.
    expect(lines[1].startsWith("id-a;A-1;CADASTRO INICIAL;")).toBe(true);
    expect(lines[2].startsWith("id-b;B-2;REVISAO DE ESTUDO;")).toBe(true);
    expect(lines[3].startsWith("id-c;C-3;PROJETO FINAL ENVIADO;")).toBe(true);
  });

  it("CSV vazio (sem projetos) ainda traz o cabeçalho", () => {
    const csv = buildProjectsCsv([]);
    expect(csv.slice(1)).toBe(EXPORT_HEADERS.join(";"));
  });

  it("observação com ; e aspas é escapada corretamente no CSV", () => {
    const csv = buildProjectsCsv([makeRow({ ultimaObservacao: 'cliente; pediu "urgência"' })]);
    expect(csv).toContain('"cliente; pediu ""urgência"""');
  });
});
