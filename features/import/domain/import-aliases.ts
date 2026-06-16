// Mapa explícito de aliases de construtoras do legado.
// Chave: variação encontrada no CSV (normalizada). Valor: nome canônico final.
// Adicionar novas entradas aqui quando o importador encontrar variações novas.

import { normalizeName } from "./import-normalize";

// Pares [padrão-normalizado, nome-canônico].
// O padrão é aplicado via normalizeName (sem acento, minúsculo, trim).
const RAW_ALIASES: [string, string][] = [
  // BILD
  ["bild = drc",         "BILD"],
  ["bild = src",         "BILD"],
  ["bild =drc",          "BILD"],
  ["bild =src",          "BILD"],
  ["bild- drc",          "BILD"],
  ["bild- src",          "BILD"],
  ["bild -drc",          "BILD"],
  ["bild -src",          "BILD"],
  // BAHIA RENT
  ["bahia rent",         "BAHIA RENT AII EIRELI"],
  ["bahia rent all",     "BAHIA RENT AII EIRELI"],
  ["bahia rental",       "BAHIA RENT AII EIRELI"],
  ["bahia rent aii",     "BAHIA RENT AII EIRELI"],
  ["bahia rent aii eireli", "BAHIA RENT AII EIRELI"],
];

// Tabela compilada: normalizeName(padrão) → nome canônico.
const ALIAS_MAP = new Map<string, string>(
  RAW_ALIASES.map(([pattern, canonical]) => [normalizeName(pattern), canonical]),
);

/**
 * Retorna o nome canônico da construtora se houver alias; caso contrário,
 * devolve o nome original (sem modificação além de trim).
 * A comparação é feita com normalizeName para ignorar acento/caixa.
 */
export function canonicalConstructorName(raw: string): string {
  const trimmed = raw.trim();
  const norm = normalizeName(trimmed);

  // Alias explícito tem prioridade.
  const aliased = ALIAS_MAP.get(norm);
  if (aliased) return aliased;

  // Se o campo contém " - ", usar somente a parte antes do separador.
  // Ex.: "BENX - BNC MADRI" → "BENX", "LOC STEEL - BRUSCA LOC" → "LOC STEEL".
  const dashIdx = trimmed.indexOf(" - ");
  if (dashIdx > 0) return trimmed.slice(0, dashIdx).trim();

  return trimmed;
}
