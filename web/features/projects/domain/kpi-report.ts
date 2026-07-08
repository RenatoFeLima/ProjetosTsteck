// View model do Relatório Executivo de KPIs (PDF).
//
// É o payload que o CLIENTE (única fonte de verdade dos cálculos de KPI) monta a
// partir do que já está na tela e envia por POST para o server renderizar o PDF.
// Assim o PDF bate exatamente com o dashboard, sem recalcular nada no backend.
//
// REGRA DE SEGURANÇA: este view model contém apenas valores de EXIBIÇÃO já
// agregados (rótulos, números, textos). NUNCA inclui IDs internos, tokens,
// hashes, e-mails, dados de sessão ou qualquer campo sensível. A validação do
// payload no server (validateKpiReport) recusa o que não bate com este formato.

export type KpiReportCard = {
  /** Rótulo do card (ex.: "Ante-projetos Enviados"). */
  label: string;
  /** Valor formatado como aparece na tela (ex.: "12", "2,6 dias úteis", "87.5%"). */
  value: string;
  /** Subtítulo/linha de apoio, quando houver (ex.: "10 projetos únicos"). */
  subtitle?: string;
  /** Base de cálculo, quando houver (ex.: "Base: 21 finalizados com historico"). */
  base?: string;
};

export type KpiReportTableRow = {
  codigo: string;
  construtoraObra: string;
  vendedor: string;
  status: string;
  diasNoStatus: number;
  prioridade: string;
  motivo: string;
  acao: string;
};

export type KpiReportReviewBlock = {
  titulo: string;
  total: number;
  projetosComRevisao: number;
  mediaPorProjeto: string;
  emRevisaoAgora: number;
  vencidas: number;
  /** Ranking opcional "Construtora — N rev." (já formatado). */
  ranking: string[];
};

export type KpiReportGargalos = {
  permanenciaMedia: string;
  concentracaoAtual: string;
  semMovimentacao: string;
  urgentesSemAvancar: string;
  acaoRecomendada: string;
};

/** View model completo do relatório — tudo já formatado para exibição. */
export type KpiReportViewModel = {
  meta: {
    /** Rótulo do período (ex.: "01/06/2026 a 30/06/2026" ou "Todos os períodos"). */
    periodo: string;
    /** Data/hora de emissão (ISO). O server formata para pt-BR. */
    emitidoEm: string;
    /** Nome de quem gerou (não e-mail nem ID). Opcional. */
    geradoPor?: string;
    /** Filtros aplicados, já formatados como "Rótulo: valor". */
    filtros: string[];
    /** Quantos projetos entraram no recorte filtrado. */
    projetosConsiderados: number;
  };
  producaoPeriodo: KpiReportCard[];
  carteiraAtual: KpiReportCard[];
  riscoOperacional: KpiReportCard[];
  eficienciaSla: KpiReportCard[];
  insights: string[];
  gargalos: KpiReportGargalos;
  revisoes: KpiReportReviewBlock[];
  projetosAtencao: {
    /** Total de itens antes do corte (para "Exibindo os principais X de Y"). */
    totalItens: number;
    /** Linhas exibidas (limitadas). */
    rows: KpiReportTableRow[];
  };
};

// ─── Validação do payload no server (defesa: não confiar cegamente no cliente) ──

const MAX_CARDS = 12;
const MAX_INSIGHTS = 20;
const MAX_REVIEWS = 4;
const MAX_TABLE_ROWS = 50;
const MAX_STR = 400;

function isStr(v: unknown, max = MAX_STR): v is string {
  return typeof v === "string" && v.length <= max;
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function cleanCard(v: unknown): KpiReportCard | null {
  if (!v || typeof v !== "object") return null;
  const c = v as Record<string, unknown>;
  if (!isStr(c.label) || !isStr(c.value)) return null;
  return {
    label: c.label,
    value: c.value,
    subtitle: isStr(c.subtitle) ? c.subtitle : undefined,
    base: isStr(c.base) ? c.base : undefined,
  };
}

function cleanCards(v: unknown): KpiReportCard[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, MAX_CARDS).map(cleanCard).filter((c): c is KpiReportCard => c !== null);
}

function cleanRow(v: unknown): KpiReportTableRow | null {
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  return {
    codigo: isStr(r.codigo) ? r.codigo : "",
    construtoraObra: isStr(r.construtoraObra) ? r.construtoraObra : "",
    vendedor: isStr(r.vendedor) ? r.vendedor : "",
    status: isStr(r.status) ? r.status : "",
    diasNoStatus: isNum(r.diasNoStatus) ? r.diasNoStatus : 0,
    prioridade: isStr(r.prioridade) ? r.prioridade : "",
    motivo: isStr(r.motivo) ? r.motivo : "",
    acao: isStr(r.acao) ? r.acao : "",
  };
}

/**
 * Valida e SANEIA o payload recebido do cliente, devolvendo um view model seguro
 * (só campos conhecidos, tamanhos limitados). Nunca lança — sempre retorna um
 * objeto renderizável. A barreira de segurança real é a permissão (403) na rota.
 */
export function validateKpiReport(input: unknown): KpiReportViewModel {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const meta = (o.meta && typeof o.meta === "object" ? o.meta : {}) as Record<string, unknown>;
  const gargalos = (o.gargalos && typeof o.gargalos === "object" ? o.gargalos : {}) as Record<string, unknown>;
  const atencao = (o.projetosAtencao && typeof o.projetosAtencao === "object" ? o.projetosAtencao : {}) as Record<string, unknown>;

  const insights = Array.isArray(o.insights)
    ? o.insights.filter((s): s is string => isStr(s)).slice(0, MAX_INSIGHTS)
    : [];

  const filtros = Array.isArray(meta.filtros)
    ? meta.filtros.filter((s): s is string => isStr(s)).slice(0, 20)
    : [];

  const revisoes = Array.isArray(o.revisoes)
    ? o.revisoes.slice(0, MAX_REVIEWS).map((v) => {
        const r = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
        return {
          titulo: isStr(r.titulo) ? r.titulo : "",
          total: isNum(r.total) ? r.total : 0,
          projetosComRevisao: isNum(r.projetosComRevisao) ? r.projetosComRevisao : 0,
          mediaPorProjeto: isStr(r.mediaPorProjeto) ? r.mediaPorProjeto : "N/D",
          emRevisaoAgora: isNum(r.emRevisaoAgora) ? r.emRevisaoAgora : 0,
          vencidas: isNum(r.vencidas) ? r.vencidas : 0,
          ranking: Array.isArray(r.ranking)
            ? r.ranking.filter((s): s is string => isStr(s)).slice(0, 5)
            : [],
        };
      })
    : [];

  const rows = Array.isArray(atencao.rows)
    ? atencao.rows.slice(0, MAX_TABLE_ROWS).map(cleanRow).filter((r): r is KpiReportTableRow => r !== null)
    : [];

  return {
    meta: {
      periodo: isStr(meta.periodo) ? meta.periodo : "Todos os períodos",
      emitidoEm: isStr(meta.emitidoEm) ? meta.emitidoEm : "",
      geradoPor: isStr(meta.geradoPor, 120) ? meta.geradoPor : undefined,
      filtros,
      projetosConsiderados: isNum(meta.projetosConsiderados) ? meta.projetosConsiderados : 0,
    },
    producaoPeriodo: cleanCards(o.producaoPeriodo),
    carteiraAtual: cleanCards(o.carteiraAtual),
    riscoOperacional: cleanCards(o.riscoOperacional),
    eficienciaSla: cleanCards(o.eficienciaSla),
    insights,
    gargalos: {
      permanenciaMedia: isStr(gargalos.permanenciaMedia) ? gargalos.permanenciaMedia : "N/D",
      concentracaoAtual: isStr(gargalos.concentracaoAtual) ? gargalos.concentracaoAtual : "N/D",
      semMovimentacao: isStr(gargalos.semMovimentacao) ? gargalos.semMovimentacao : "0",
      urgentesSemAvancar: isStr(gargalos.urgentesSemAvancar) ? gargalos.urgentesSemAvancar : "0",
      acaoRecomendada: isStr(gargalos.acaoRecomendada) ? gargalos.acaoRecomendada : "",
    },
    revisoes,
    projetosAtencao: {
      totalItens: isNum(atencao.totalItens) ? atencao.totalItens : rows.length,
      rows,
    },
  };
}
