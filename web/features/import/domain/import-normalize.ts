// Normalização e parsing de campos do CSV legado. Módulo puro (sem Prisma),
// reutilizado pelo serviço de importação e coberto por testes.

import { onlyDigits } from "@/features/master-data/lib/masks";

/** Normaliza nome para matching: sem acento, minúsculo, trim, espaços colapsados.
 *  Usado para casar Construtora/Obra/Vendedor/Cabine/Engenheiro com o banco. */
export function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Normaliza código (equipamento): maiúsculo, sem hífen/barra/espaço/ponto. */
export function normalizeCode(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[-\/\s.]/g, "");
}

/** Normaliza nome para matching sem pontuação (pontos, hifens, &, /):
 *  além de acentos/case/espaços, remove sinais de pontuação comuns em
 *  nomes de empresas ("PLANO & PLANO" -> "plano  plano", etc.). */
export function normalizeNameLoose(value: string | null | undefined): string {
  return normalizeName(value).replace(/[&\/\-_.,()'"+]/g, " ").replace(/\s+/g, " ").trim();
}

/** VERDADEIRO/FALSO (e variações) -> boolean. `undefined` quando não reconhece. */
export function parseBoolPt(value: string | null | undefined): boolean | undefined {
  const v = normalizeName(value);
  if (["verdadeiro", "v", "sim", "true", "1", "x"].includes(v)) return true;
  if (["falso", "f", "nao", "false", "0", ""].includes(v)) return false;
  return undefined;
}

/** Remove o prefixo "ENG." / "ENG" do nome do engenheiro e normaliza espaços. */
export function cleanEngineerName(value: string | null | undefined): string {
  const raw = (value ?? "").trim().replace(/\s+/g, " ");
  return raw.replace(/^eng\.?\s+/i, "").trim();
}

export type DateParse = { ok: true; date: Date | null } | { ok: false; raw: string };

function makeDate(day: number, month: number, year: number): Date | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return d;
}

/** Parse de data inteligente: tenta dd/MM/yyyy brasileiro primeiro;
 *  se o primeiro segmento > 12 é inequivocamente americano (MM/dd/yyyy);
 *  se o segundo segmento > 12, usa dd/MM/yyyy;
 *  se ambíguo (ambos ≤ 12), assume brasileiro (dd/MM).
 *  Formatos: d/M/yyyy, d/M/yy, d/M/yyyy. Vazio -> null. Inválido -> erro. */
export function parseDateBr(value: string | null | undefined): DateParse {
  const raw = (value ?? "").trim();
  if (!raw) return { ok: true, date: null };
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return { ok: false, raw };
  const a = Number(m[1]);
  const b = Number(m[2]);
  let year = Number(m[3]);
  if (m[3].length === 2) year += year < 70 ? 2000 : 1900;

  // a > 12: só pode ser dd/MM (dia não pode ser mês)
  // b > 12: só pode ser MM/dd americano (segundo campo não pode ser mês)
  // ambos ≤ 12: assume brasileiro dd/MM
  if (b > 12) {
    // formato americano MM/dd/yyyy
    const d = makeDate(b, a, year);
    if (!d) return { ok: false, raw };
    return { ok: true, date: d };
  }
  // dd/MM/yyyy (brasileiro, default)
  const d = makeDate(a, b, year);
  if (!d) return { ok: false, raw };
  return { ok: true, date: d };
}

/** @deprecated use parseDateBr — mantido para compatibilidade de testes. */
export const parseDateStrict = parseDateBr;

export { onlyDigits };
