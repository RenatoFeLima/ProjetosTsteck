// Log de performance temporário para diagnóstico de latência das rotas.
// Nunca loga senhas, tokens, hash, e-mails, conteúdo SMTP, DATABASE_URL ou AUTH_SECRET —
// apenas rótulos, operação, tempos (ms) e sucesso/falha.

export function startTimer(): () => number {
  const t0 = Date.now();
  return () => Date.now() - t0;
}

export function logPerf(
  label: string,
  totalMs: number,
  opts: { success?: boolean; phases?: Record<string, number> } = {},
): void {
  const status = opts.success === undefined ? "" : ` ${opts.success ? "ok" : "fail"}`;
  const extra = opts.phases
    ? " " + Object.entries(opts.phases).map(([k, v]) => `${k}=${v}ms`).join(" ")
    : "";
  console.log(`[perf] ${label}${status} total=${totalMs}ms${extra}`);
}
