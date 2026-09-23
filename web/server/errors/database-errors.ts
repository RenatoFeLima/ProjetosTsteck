// Detecção de INDISPONIBILIDADE do banco (≠ erro de programação).
//
// Só entra aqui o que comprovadamente indica "o banco não está alcançável
// agora" — esses casos viram 503 SERVICE_UNAVAILABLE, sinalizando ao usuário
// que vale tentar de novo em instantes.
//
// ⚠️ NÃO generalizar: erro de query, violação de constraint, campo inexistente
// etc. são BUGS e devem continuar 500. Esconder bug atrás de 503 faz a equipe
// perder o sinal de que existe algo para corrigir.

/** Códigos de erro do Prisma que significam "não consegui falar com o banco".
 *  Ref.: P1001 unreachable, P1002 timeout no handshake, P1008 timeout de
 *  operação, P1017 conexão fechada pelo servidor. */
const PRISMA_UNAVAILABLE_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);

/** Nomes de erro do Prisma que só ocorrem quando o cliente sequer inicializa. */
const UNAVAILABLE_ERROR_NAMES = new Set(["PrismaClientInitializationError"]);

/** Trechos de mensagem de erros de rede/socket observados no incidente. */
const UNAVAILABLE_MESSAGE_PATTERNS = [
  "can't reach database server",
  "cant reach database server",
  "server has closed the connection",
  "connection refused",
  "econnrefused",
  "etimedout",
  "econnreset",
  "enotfound",
  "timed out fetching a new connection",
];

function readString(source: object, key: string): string | null {
  const value = (source as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

/**
 * `true` somente quando dá para AFIRMAR que é indisponibilidade temporária
 * de infraestrutura do banco. Na dúvida retorna `false` (⇒ 500).
 */
export function isDatabaseUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const name = readString(error, "name");
  if (name && UNAVAILABLE_ERROR_NAMES.has(name)) return true;

  const code = readString(error, "code");
  if (code && PRISMA_UNAVAILABLE_CODES.has(code)) return true;

  const message = readString(error, "message");
  if (message) {
    const normalized = message.toLowerCase();
    if (UNAVAILABLE_MESSAGE_PATTERNS.some((pattern) => normalized.includes(pattern))) {
      return true;
    }
  }

  // Erros de rede costumam vir embrulhados (ex.: `cause` do undici/Node).
  const cause = (error as { cause?: unknown }).cause;
  if (cause && cause !== error) return isDatabaseUnavailableError(cause);

  return false;
}
