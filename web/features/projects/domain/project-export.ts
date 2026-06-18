// Exportação de projetos para CSV compatível com Excel (pt-BR).
// Módulo PURO (sem Prisma): recebe linhas já desnormalizadas e produz o texto
// CSV. Coberto por testes. O serviço apenas carrega os dados e chama daqui.
//
// Formato: separador ";", BOM UTF-8 (Excel pt-BR abre direto), datas dd/mm/aaaa,
// booleanos "Sim"/"Não", status com label amigável.

import { DB_TO_UI_STATUS, type DbStatus } from "./project-status-map";

/** Linha de origem (campos crus do banco, já com relações resolvidas). */
export type ProjectExportRow = {
  /** ID técnico do projeto — chave segura para reimportação. */
  id: string;
  code: string;
  status: string; // DB enum
  construtora: string | null;
  obra: string | null;
  vendedor: string | null;
  equipamento: string | null;
  tipoCabine: string | null;
  engenheiro: string | null;
  telefone: string | null;
  dataLancamento: Date | string | null;
  projetoObraRecebido: boolean;
  localCabineDefinido: boolean;
  alinhamentoConcluido: boolean;
  dataAlinhamento: Date | string | null;
  urgente: boolean;
  prazoUrgencia: Date | string | null;
  motivoUrgencia: string | null;
  prazoOperacional: Date | string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  qtdObservacoes: number;
  ultimaObservacao: string | null;
};

// Cabeçalho da coluna técnica de ID (chave de reimportação). Constante
// compartilhada com o importador.
export const ID_HEADER = "ID do Projeto";

// Cabeçalho amigável (ordem fixa = ordem das colunas).
export const EXPORT_HEADERS = [
  ID_HEADER,
  "Código",
  "Status",
  "Construtora",
  "Obra",
  "Vendedor",
  "Equipamento",
  "Tipo de Cabine",
  "Engenheiro",
  "Telefone",
  "Data de Lançamento",
  "Projeto de Obra Recebido",
  "Local da Cabine Definido",
  "Alinhamento Concluído",
  "Data do Alinhamento",
  "Urgente",
  "Prazo da Urgência",
  "Motivo da Urgência",
  "Prazo Operacional",
  "Data de Criação",
  "Data de Atualização",
  "Qtd. Observações",
  "Última Observação",
] as const;

/** Data → dd/mm/aaaa. Aceita Date ou string ISO/yyyy-MM-dd. Vazio → "". */
export function formatDateBr(value: Date | string | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    // Pode ser "yyyy-MM-dd" sem horário válido p/ Date em alguns runtimes.
    const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/** Boolean → "Sim"/"Não". */
export function formatBool(value: boolean | null | undefined): string {
  return value ? "Sim" : "Não";
}

/** Label amigável do status (DB enum → rótulo da UI). */
export function statusLabel(dbStatus: string): string {
  return DB_TO_UI_STATUS[dbStatus as DbStatus] ?? dbStatus;
}

/** Escapa um campo para CSV (separador ";"): aspas se contiver ; " ou quebra. */
export function escapeCsvField(value: string): string {
  const needsQuote = /[";\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

/** Converte uma linha de projeto na ordem das colunas (strings já formatadas). */
export function projectRowToCells(row: ProjectExportRow): string[] {
  return [
    row.id ?? "",
    row.code ?? "",
    statusLabel(row.status),
    row.construtora ?? "",
    row.obra ?? "",
    row.vendedor ?? "",
    row.equipamento ?? "",
    row.tipoCabine ?? "",
    row.engenheiro ?? "",
    row.telefone ?? "",
    formatDateBr(row.dataLancamento),
    formatBool(row.projetoObraRecebido),
    formatBool(row.localCabineDefinido),
    formatBool(row.alinhamentoConcluido),
    formatDateBr(row.dataAlinhamento),
    formatBool(row.urgente),
    formatDateBr(row.prazoUrgencia),
    row.motivoUrgencia ?? "",
    formatDateBr(row.prazoOperacional),
    formatDateBr(row.createdAt),
    formatDateBr(row.updatedAt),
    String(row.qtdObservacoes ?? 0),
    row.ultimaObservacao ?? "",
  ];
}

/**
 * Gera o conteúdo CSV completo (com BOM UTF-8) a partir das linhas.
 * Separador ";" para compatibilidade com Excel pt-BR; CRLF entre linhas.
 */
export function buildProjectsCsv(rows: ProjectExportRow[]): string {
  const lines: string[] = [];
  lines.push(EXPORT_HEADERS.map((h) => escapeCsvField(h)).join(";"));
  for (const row of rows) {
    lines.push(projectRowToCells(row).map((c) => escapeCsvField(c)).join(";"));
  }
  // BOM + CRLF para o Excel reconhecer UTF-8 e as quebras de linha.
  return "﻿" + lines.join("\r\n");
}

/** Nome do arquivo: projetos-tsteck-YYYY-MM-DD-HHmm.csv */
export function exportFileName(now: Date, ext: "csv" | "xlsx" = "csv"): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `projetos-tsteck-${stamp}.${ext}`;
}
