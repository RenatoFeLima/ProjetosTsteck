// @vitest-environment node
// Geração do PDF é server-side (pdfkit, Node puro). Não há banco envolvido.
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { generateKpiReportPdf } from "@/server/services/kpiReportPdf";
import { validateKpiReport, type KpiReportViewModel } from "@/features/projects/domain/kpi-report";

afterEach(() => vi.restoreAllMocks());

function sampleViewModel(overrides: Partial<KpiReportViewModel> = {}): KpiReportViewModel {
  return validateKpiReport({
    meta: {
      periodo: "01/06/2026 a 30/06/2026",
      emitidoEm: "2026-07-08T13:30:00.000Z",
      geradoPor: "Renato",
      filtros: ["Status: ELABORAR ANTE-PROJETO", "Vendedor: RENATO"],
      projetosConsiderados: 42,
    },
    producaoPeriodo: [
      { label: "Ante-projetos Enviados", value: "12", subtitle: "10 projetos únicos" },
      { label: "Projetos Finais Enviados", value: "8", subtitle: "8 projetos únicos" },
      { label: "Projetos Aprovados", value: "5", subtitle: "5 projetos únicos" },
      { label: "Tempo Médio de Entrega", value: "2,6 dias úteis" },
    ],
    carteiraAtual: [
      { label: "Total de Projetos", value: "42" },
      { label: "Em Andamento", value: "37" },
      { label: "Em Projeto Final Enviado", value: "8" },
      { label: "Aprovados atualmente", value: "5" },
    ],
    riscoOperacional: [
      { label: "Atrasados por SLA", value: "3", base: "Base: 8 em status com SLA" },
      { label: "Projetos Urgentes", value: "4" },
      { label: "Sem Movimentação", value: "6" },
      { label: "Projetos com SLA sem prazo", value: "0", base: "Base: 8 em status com SLA" },
    ],
    eficienciaSla: [
      { label: "SLA de Entregas Finalizadas", value: "87.5%", base: "Base: 21 finalizados com historico" },
      { label: "Taxa de Conclusão", value: "42.0%" },
      { label: "Idade Média (Abertos)", value: "18.0 dias" },
    ],
    insights: ["O status X concentra 40% dos projetos.", "Projetos urgentes representam 9% da carteira."],
    gargalos: {
      permanenciaMedia: "ELABORAR ANTE-PROJETO (5.0 dias)",
      concentracaoAtual: "ANTE-PROJETO ENVIADO (10 projetos)",
      semMovimentacao: "6",
      urgentesSemAvancar: "2",
      acaoRecomendada: "Priorizar a análise dos projetos no status com maior concentração.",
    },
    revisoes: [
      { titulo: "Revisão de Estudo", total: 5, projetosComRevisao: 3, mediaPorProjeto: "1.7", emRevisaoAgora: 2, vencidas: 1, ranking: ["ACRY — 3 rev."] },
      { titulo: "Revisão de Projeto Final", total: 2, projetosComRevisao: 2, mediaPorProjeto: "1.0", emRevisaoAgora: 1, vencidas: 0, ranking: [] },
    ],
    projetosAtencao: {
      totalItens: 30,
      rows: Array.from({ length: 30 }, (_, i) => ({
        codigo: `CRE-${1000 + i}`,
        construtoraObra: "ACRY / ARTHUR DE AZEVEDO",
        vendedor: "RENATO",
        status: "REVISAO DE ESTUDO",
        diasNoStatus: 12 + i,
        prioridade: i % 2 === 0 ? "Urgente" : "Normal",
        motivo: "Parado ha 12 dias",
        acao: "Escalar bloqueio e definir plano de destravamento.",
      })).slice(0, 25),
    },
    ...overrides,
  });
}

describe("generateKpiReportPdf", () => {
  it("gera um Buffer PDF válido (magic bytes %PDF-)", async () => {
    const pdf = await generateKpiReportPdf(sampleViewModel());
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // Fim de arquivo PDF.
    expect(pdf.subarray(-6).toString("latin1")).toContain("%%EOF");
  });

  it("gera PDF mesmo com dados vazios (sem lançar)", async () => {
    const empty = validateKpiReport({});
    const pdf = await generateKpiReportPdf(empty);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);
  });

  it("não quebra com tabela grande (25 linhas) e ranking", async () => {
    const pdf = await generateKpiReportPdf(sampleViewModel());
    expect(pdf.length).toBeGreaterThan(2000);
  });

  it("gera PDF com fallback textual quando a logo está ausente (não quebra)", async () => {
    // Simula o asset da logo indisponível no ambiente (ex.: bundle serverless).
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const pdf = await generateKpiReportPdf(sampleViewModel());
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it("gera PDF mesmo se a leitura da logo lançar erro (fallback)", async () => {
    vi.spyOn(fs, "existsSync").mockImplementation(() => {
      throw new Error("EACCES");
    });
    const pdf = await generateKpiReportPdf(sampleViewModel());
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("trata dados ausentes como N/D/vazio sem estourar", async () => {
    // Payload minimo/vazio já saneado — deve gerar PDF válido.
    const vm = validateKpiReport({ producaoPeriodo: [{ label: "X", value: "1" }] });
    const pdf = await generateKpiReportPdf(vm);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
