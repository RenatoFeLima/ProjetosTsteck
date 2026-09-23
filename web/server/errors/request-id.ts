// Código de atendimento (correlation id) para rastrear 500/503.
//
// Formato curto e ditável por telefone: XXXX-XXXX (hex maiúsculo). Gerado a
// partir de crypto.randomUUID() — NÃO deriva de id de usuário, IP, sessão ou
// qualquer outro dado sensível; serve apenas para casar a tela com o log.

export const REQUEST_ID_HEADER = "X-Request-ID";

/** Gera um código de atendimento novo, ex.: "8F2C-91A4". */
export function newRequestId(): string {
  const hex = globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

/** Aceita um id vindo de fora (ex.: header) só se tiver o formato esperado. */
export function isRequestId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9A-F]{4}-[0-9A-F]{4}$/.test(value);
}
