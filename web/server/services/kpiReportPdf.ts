// Geração do Relatório Executivo de KPIs em PDF (pdfkit, Node puro).
//
// Recebe um KpiReportViewModel JÁ validado/saneado e desenha um PDF A4 retrato,
// visual corporativo TSTECK (branco/cinza/preto/vermelho), com cabeçalho + logo,
// seções em cards, tabela de projetos críticos, rodapé e numeração de página.
// NÃO faz nenhum cálculo de KPI — apenas renderiza o que veio da tela.

import path from "node:path";
import fs from "node:fs";
import PDFDocument from "pdfkit";
import type { KpiReportViewModel, KpiReportCard } from "@/features/projects/domain/kpi-report";

// ─── Paleta TSTECK ──────────────────────────────────────────────────────────
const BRAND = "#9e0b0f";
const INK = "#18181b";
const MUTED = "#6b7280";
const LINE = "#e4e4e7";
const SOFT = "#f4f4f5";
const SUCCESS = "#027a48";
const DANGER = "#b42318";

const PAGE_MARGIN = 40;
const A4_WIDTH = 595.28; // pt
const CONTENT_WIDTH = A4_WIDTH - PAGE_MARGIN * 2;

const LOGO_PATH = path.join(process.cwd(), "public", "logo-tsteck.png");

function formatEmittedAt(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Gera o PDF e resolve com o Buffer completo. */
export function generateKpiReportPdf(vm: KpiReportViewModel): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      renderHeader(doc, vm);
      renderCardSection(doc, "1. Produção do Período", vm.producaoPeriodo);
      renderCardSection(doc, "2. Carteira Atual", vm.carteiraAtual);
      renderCardSection(doc, "3. Risco Operacional", vm.riscoOperacional, "risco");
      renderCardSection(doc, "4. Eficiência / SLA", vm.eficienciaSla);
      renderInsights(doc, vm);
      renderGargalos(doc, vm);

      // Página 2 — análise operacional
      doc.addPage();
      renderReviews(doc, vm);
      renderCriticalTable(doc, vm);

      renderFootersAndPageNumbers(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ─── Cabeçalho ──────────────────────────────────────────────────────────────
function renderHeader(doc: PDFKit.PDFDocument, vm: KpiReportViewModel) {
  const top = PAGE_MARGIN;

  // Logo (best-effort). Se o arquivo faltar ou a leitura falhar (ex.: asset não
  // incluído no bundle serverless), cai no fallback textual "TSTECK" — o PDF
  // NUNCA quebra por causa da logo.
  let logoOk = false;
  try {
    if (fs.existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, PAGE_MARGIN, top, { fit: [120, 44] });
      logoOk = true;
    }
  } catch {
    logoOk = false;
  }
  if (!logoOk) {
    doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(22).text("TSTECK", PAGE_MARGIN, top + 8, { lineBreak: false });
  }

  // Faixa vermelha de acento à direita do título.
  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(16)
    .text("Relatório Executivo de KPIs", PAGE_MARGIN, top + 2, { align: "right", width: CONTENT_WIDTH });
  doc
    .fillColor(BRAND)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text("Gestão de Projetos", PAGE_MARGIN, top + 22, { align: "right", width: CONTENT_WIDTH });

  let y = top + 52;
  doc.moveTo(PAGE_MARGIN, y).lineTo(A4_WIDTH - PAGE_MARGIN, y).lineWidth(2).strokeColor(BRAND).stroke();
  y += 10;

  const line = (label: string, value: string) => {
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTED).text(label, PAGE_MARGIN, y, { continued: true });
    doc.font("Helvetica").fillColor(INK).text(` ${value}`);
    y = doc.y + 2;
  };
  line("Período analisado:", vm.meta.periodo);
  line("Emitido em:", formatEmittedAt(vm.meta.emitidoEm));
  if (vm.meta.geradoPor) line("Gerado por:", vm.meta.geradoPor);
  line("Projetos considerados:", String(vm.meta.projetosConsiderados));
  line("Filtros aplicados:", vm.meta.filtros.join("  •  "));

  doc.y = y + 6;
}

// ─── Seção de cards ─────────────────────────────────────────────────────────
function sectionTitle(doc: PDFKit.PDFDocument, title: string) {
  ensureSpace(doc, 40);
  const y = doc.y + 6;
  doc.rect(PAGE_MARGIN, y, 3, 12).fill(BRAND);
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(11).text(title, PAGE_MARGIN + 8, y);
  doc.y = y + 18;
}

function renderCardSection(
  doc: PDFKit.PDFDocument,
  title: string,
  cards: KpiReportCard[],
  tone: "default" | "risco" = "default",
) {
  sectionTitle(doc, title);
  if (!cards.length) {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Sem dados para este bloco.", PAGE_MARGIN, doc.y);
    doc.y += 6;
    return;
  }

  const perRow = 4;
  const gap = 8;
  const cardW = (CONTENT_WIDTH - gap * (perRow - 1)) / perRow;
  const cardH = 62;

  for (let i = 0; i < cards.length; i += perRow) {
    const rowCards = cards.slice(i, i + perRow);
    ensureSpace(doc, cardH + 8);
    const rowY = doc.y;
    rowCards.forEach((card, col) => {
      const x = PAGE_MARGIN + col * (cardW + gap);
      drawCard(doc, x, rowY, cardW, cardH, card, tone);
    });
    doc.y = rowY + cardH + gap;
  }
  doc.y += 2;
}

function drawCard(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  card: KpiReportCard,
  tone: "default" | "risco",
) {
  doc.roundedRect(x, y, w, h, 5).lineWidth(0.8).fillAndStroke(SOFT, LINE);
  const accent = tone === "risco" ? DANGER : BRAND;
  doc.rect(x, y, w, 2.5).fill(accent);

  const pad = 7;
  doc
    .fillColor(MUTED)
    .font("Helvetica-Bold")
    .fontSize(6.5)
    .text(card.label.toUpperCase(), x + pad, y + 7, { width: w - pad * 2, height: 16, ellipsis: true });

  doc
    .fillColor(INK)
    .font("Helvetica-Bold")
    .fontSize(15)
    .text(card.value, x + pad, y + 22, { width: w - pad * 2, ellipsis: true });

  let subY = y + 41;
  if (card.base) {
    doc.fillColor(MUTED).font("Helvetica").fontSize(5.8).text(card.base, x + pad, subY, { width: w - pad * 2, ellipsis: true });
    subY += 8;
  }
  if (card.subtitle) {
    doc.fillColor(MUTED).font("Helvetica").fontSize(5.8).text(card.subtitle, x + pad, subY, { width: w - pad * 2, height: 10, ellipsis: true });
  }
}

// ─── Insights ───────────────────────────────────────────────────────────────
function renderInsights(doc: PDFKit.PDFDocument, vm: KpiReportViewModel) {
  sectionTitle(doc, "5. Insights do Período");
  if (!vm.insights.length) {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Não há insights para este período.", PAGE_MARGIN, doc.y);
    doc.y += 6;
    return;
  }
  for (const insight of vm.insights) {
    ensureSpace(doc, 16);
    const y = doc.y;
    doc.circle(PAGE_MARGIN + 3, y + 5, 1.6).fill(BRAND);
    doc.fillColor(INK).font("Helvetica").fontSize(9).text(insight, PAGE_MARGIN + 12, y, { width: CONTENT_WIDTH - 12 });
    doc.y += 3;
  }
  doc.y += 4;
}

// ─── Gargalos do Fluxo ──────────────────────────────────────────────────────
function renderGargalos(doc: PDFKit.PDFDocument, vm: KpiReportViewModel) {
  sectionTitle(doc, "6. Gargalos do Fluxo");
  const g = vm.gargalos;
  const items: [string, string][] = [
    ["Status com maior permanência média", g.permanenciaMedia],
    ["Maior concentração atual", g.concentracaoAtual],
    ["Projetos sem movimentação", g.semMovimentacao],
    ["Urgentes sem avançar", g.urgentesSemAvancar],
  ];
  for (const [label, value] of items) {
    ensureSpace(doc, 14);
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTED).text(`${label}: `, PAGE_MARGIN, y, { continued: true });
    doc.font("Helvetica").fillColor(INK).text(value);
    doc.y += 2;
  }
  ensureSpace(doc, 26);
  const boxY = doc.y + 4;
  doc.roundedRect(PAGE_MARGIN, boxY, CONTENT_WIDTH, 22, 4).fillAndStroke("#fdf2f2", "#f3c6c6");
  doc
    .fillColor(BRAND)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("Ação recomendada: ", PAGE_MARGIN + 8, boxY + 6, { continued: true });
  doc.fillColor(INK).font("Helvetica").text(g.acaoRecomendada, { width: CONTENT_WIDTH - 16 });
  doc.y = boxY + 28;
}

// ─── Revisões ───────────────────────────────────────────────────────────────
function renderReviews(doc: PDFKit.PDFDocument, vm: KpiReportViewModel) {
  sectionTitle(doc, "Revisões");
  const gap = 12;
  const colW = (CONTENT_WIDTH - gap) / 2;
  const startY = doc.y;
  let maxBottom = startY;

  vm.revisoes.forEach((r, idx) => {
    const x = PAGE_MARGIN + idx * (colW + gap);
    let y = startY;
    doc.roundedRect(x, y, colW, 118, 5).lineWidth(0.8).fillAndStroke("#ffffff", LINE);
    doc.rect(x, y, colW, 2.5).fill(idx === 0 ? "#ea580c" : BRAND);
    y += 8;
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text(r.titulo, x + 8, y, { width: colW - 16 });
    y = doc.y + 4;

    const stat = (label: string, value: string) => {
      doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(label, x + 8, y, { continued: true, width: colW - 16 });
      doc.font("Helvetica-Bold").fillColor(INK).text(`  ${value}`);
      y = doc.y + 1;
    };
    stat("Total de revisões:", String(r.total));
    stat("Projetos com revisão:", String(r.projetosComRevisao));
    stat("Média por projeto:", r.mediaPorProjeto);
    stat("Em revisão agora:", String(r.emRevisaoAgora));
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text("Revisões vencidas:", x + 8, y, { continued: true, width: colW - 16 });
    doc.font("Helvetica-Bold").fillColor(r.vencidas > 0 ? DANGER : SUCCESS).text(`  ${r.vencidas}`);
    y = doc.y + 2;

    if (r.ranking.length) {
      doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED).text("Construtoras com mais revisões", x + 8, y, { width: colW - 16 });
      y = doc.y + 1;
      for (const line of r.ranking.slice(0, 3)) {
        doc.font("Helvetica").fontSize(7).fillColor(INK).text(line, x + 8, y, { width: colW - 16, ellipsis: true });
        y = doc.y;
      }
    }
    maxBottom = Math.max(maxBottom, startY + 118);
  });

  doc.y = maxBottom + 12;
}

// ─── Tabela de projetos que exigem atenção ─────────────────────────────────
function renderCriticalTable(doc: PDFKit.PDFDocument, vm: KpiReportViewModel) {
  sectionTitle(doc, "Projetos que Exigem Atenção");

  const { rows, totalItens } = vm.projetosAtencao;
  if (totalItens > rows.length) {
    doc
      .font("Helvetica-Oblique")
      .fontSize(8)
      .fillColor(MUTED)
      .text(`Exibindo os principais ${rows.length} projetos de ${totalItens} itens.`, PAGE_MARGIN, doc.y);
    doc.y += 6;
  }
  if (!rows.length) {
    doc.font("Helvetica").fontSize(9).fillColor(SUCCESS).text("Nenhum projeto exige atenção no momento.", PAGE_MARGIN, doc.y);
    return;
  }

  // Colunas: Código, Construtora/Obra, Vendedor, Status, Dias, Prioridade, Motivo, Ação
  const cols = [
    { key: "codigo", label: "Código", w: 52 },
    { key: "construtoraObra", label: "Construtora / Obra", w: 92 },
    { key: "vendedor", label: "Vendedor", w: 55 },
    { key: "status", label: "Status", w: 70 },
    { key: "diasNoStatus", label: "Dias", w: 26 },
    { key: "prioridade", label: "Prior.", w: 34 },
    { key: "motivo", label: "Motivo", w: 75 },
    { key: "acao", label: "Ação", w: CONTENT_WIDTH - (52 + 92 + 55 + 70 + 26 + 34 + 75) },
  ] as const;

  const drawHeaderRow = () => {
    const y = doc.y;
    doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 16).fill(INK);
    let x = PAGE_MARGIN;
    for (const c of cols) {
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(6.8).text(c.label, x + 3, y + 5, { width: c.w - 5, ellipsis: true });
      x += c.w;
    }
    doc.y = y + 16;
  };

  drawHeaderRow();

  rows.forEach((row, idx) => {
    const cellValue = (key: string): string => {
      const v = (row as unknown as Record<string, unknown>)[key];
      return typeof v === "number" ? String(v) : (v as string) ?? "";
    };
    // Altura da linha = maior célula (motivo/ação quebram).
    const heights = cols.map((c) => doc.font("Helvetica").fontSize(6.8).heightOfString(cellValue(c.key), { width: c.w - 6 }));
    const rowH = Math.max(14, ...heights) + 4;

    if (doc.y + rowH > doc.page.height - PAGE_MARGIN - 24) {
      doc.addPage();
      drawHeaderRow();
    }

    const y = doc.y;
    if (idx % 2 === 1) doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, rowH).fill(SOFT);
    let x = PAGE_MARGIN;
    for (const c of cols) {
      const isPri = c.key === "prioridade";
      const urgent = row.prioridade === "Urgente";
      doc
        .fillColor(isPri && urgent ? DANGER : INK)
        .font(isPri && urgent ? "Helvetica-Bold" : "Helvetica")
        .fontSize(6.8)
        .text(cellValue(c.key), x + 3, y + 3, { width: c.w - 6 });
      x += c.w;
    }
    doc.y = y + rowH;
    doc.moveTo(PAGE_MARGIN, doc.y).lineTo(A4_WIDTH - PAGE_MARGIN, doc.y).lineWidth(0.3).strokeColor(LINE).stroke();
  });
}

// ─── Rodapé + numeração ─────────────────────────────────────────────────────
function renderFootersAndPageNumbers(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i += 1) {
    doc.switchToPage(range.start + i);
    const y = doc.page.height - PAGE_MARGIN + 6;
    doc.moveTo(PAGE_MARGIN, y - 4).lineTo(A4_WIDTH - PAGE_MARGIN, y - 4).lineWidth(0.5).strokeColor(LINE).stroke();
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(7)
      .text("TSTECK Equipamentos — Relatório gerado a partir do painel de KPIs de Projetos", PAGE_MARGIN, y, {
        width: CONTENT_WIDTH - 60,
        lineBreak: false,
      });
    doc.text(`Página ${i + 1} de ${total}`, A4_WIDTH - PAGE_MARGIN - 60, y, { width: 60, align: "right", lineBreak: false });
  }
}

// ─── Utilitário: quebra de página quando falta espaço ──────────────────────
function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > doc.page.height - PAGE_MARGIN - 24) {
    doc.addPage();
  }
}
