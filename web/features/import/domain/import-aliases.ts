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
  const norm = normalizeName(raw.trim());
  return ALIAS_MAP.get(norm) ?? raw.trim();
}
