// Regras do código do projeto. A sequência é GLOBAL: considera apenas os últimos
// dígitos numéricos do código, independente do prefixo. O prefixo é preservado
// como sugestão inicial, mas pode ser editado livremente.

/** Sufixo numérico (últimos dígitos) do código. Ex.: "CRE-POÇ-0012" -> 12. */
export function extractCodeSuffix(code: string): number | null {
  const m = (code ?? "").trim().match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

/** Prefixo = código sem o grupo numérico final (e o separador "-"). */
export function extractCodePrefix(code: string): string {
  return (code ?? "").trim().replace(/-?\d+\s*$/, "");
}

/** Garante padding de 4 dígitos (não trunca números maiores). */
export function padSuffix(n: number): string {
  return String(Math.max(0, Math.trunc(n))).padStart(4, "0");
}

/** Maior sufixo numérico entre todos os códigos (0 se nenhum). */
export function maxCodeSuffix(codes: string[]): number {
  let max = 0;
  for (const code of codes) {
    const n = extractCodeSuffix(code);
    if (n !== null && n > max) max = n;
  }
  return max;
}

/** Próximo código sugerido: prefixo do código atual + (maxSuffix + 1) com padding. */
export function suggestNextCode(currentCode: string, maxSuffix: number): string {
  const prefix = extractCodePrefix(currentCode);
  const next = padSuffix(maxSuffix + 1);
  return prefix ? `${prefix}-${next}` : next;
}

/** Formato mínimo: precisa terminar com ao menos 4 dígitos numéricos. */
export function hasValidFinalCode(code: string): boolean {
  return /\d{4}\s*$/.test((code ?? "").trim());
}

/** Sufixo da SEQUÊNCIA de códigos finais: só "-" + exatamente 4 dígitos no fim
 *  ("CRE-POM-2160" → 2160, "CRE-ABC-0001" → 1). Mais restrito que
 *  hasValidFinalCode de propósito: "15111", "X2160", "216", "21ZZ" e "1864R1"
 *  não entram na numeração (null). Usado só pela sugestão do código final. */
export function finalSequenceSuffix(code: string): number | null {
  const m = (code ?? "").trim().match(/-(\d{4})$/);
  return m ? Number(m[1]) : null;
}

/** Código de maior sufixo de sequência (null se nenhum for válido). */
export function highestFinalCode(codes: string[]): { code: string; suffix: number } | null {
  let best: { code: string; suffix: number } | null = null;
  for (const code of codes) {
    const suffix = finalSequenceSuffix(code);
    if (suffix !== null && (best === null || suffix > best.suffix)) best = { code: code.trim(), suffix };
  }
  return best;
}

/** Sugestão do código final a partir dos códigos dos projetos ATUALMENTE em
 *  PROJETO FINAL ENVIADO: prefixo do código de maior sufixo + (maior + 1).
 *  Sem nenhum código válido, não inventa sequência: devolve o código
 *  atual/provisório para o usuário informar manualmente. */
export function suggestFinalCodeFromSent(
  sentCodes: string[],
  currentCode?: string | null,
): { lastFinalCode: string | null; maxSuffix: number | null; suggestedFinalCode: string | null } {
  const draft = currentCode?.trim() || null;
  const highest = highestFinalCode(sentCodes);
  if (!highest) return { lastFinalCode: null, maxSuffix: null, suggestedFinalCode: draft };
  return {
    lastFinalCode: highest.code,
    maxSuffix: highest.suffix,
    suggestedFinalCode: suggestNextCode(highest.code, highest.suffix),
  };
}
