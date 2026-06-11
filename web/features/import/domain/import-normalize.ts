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

/** Normaliza código (equipamento): maiúsculo, trim, espaços colapsados. */
export function normalizeCode(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
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

/** Parse estrito de data no formato brasileiro dd/MM/yyyy ou dd/MM/yy.
 *  (Decisão do usuário: assumir sempre dd/MM; valores fora do padrão viram erro.)
 *  Vazio -> { ok:true, date:null }. Inválido -> { ok:false, raw }. */
export function parseDateBr(value: string | null | undefined): DateParse {
  const raw = (value ?? "").trim();
  if (!raw) return { ok: true, date: null };
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return { ok: false, raw };
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (m[3].length === 2) year += year < 70 ? 2000 : 1900;
  if (month < 1 || month > 12 || day < 1 || day > 31) return { ok: false, raw };
  const d = new Date(Date.UTC(year, month - 1, day));
  // rejeita overflow (ex.: 31/02 -> 03/03)
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return { ok: false, raw };
  return { ok: true, date: d };
}

export { onlyDigits };
