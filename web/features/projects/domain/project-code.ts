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
