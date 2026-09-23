// Catálogo central de erros da aplicação — fonte ÚNICA da tradução entre o
// código técnico usado pelo backend e o texto mostrado ao usuário.
//
// Nenhuma tela deve inventar a própria frase de erro: chame
// `getUserFriendlyError(code, context)` e renderize com <AppErrorMessage />.
//
// Isomórfico (client + server): NÃO importe nada server-only aqui.

export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_INACTIVE"
  | "SESSION_EXPIRED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "CSRF_INVALID"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR"
  | "NETWORK_ERROR";

export type ErrorSeverity = "info" | "warning" | "critical";

/** Superfície de exibição — permite ajustar o texto sem duplicar o catálogo. */
export type ErrorSurface = "generic" | "login";

type CatalogEntry = {
  status: number;
  severity: ErrorSeverity;
  title: string;
  description: string;
  /** Rótulo do botão de ação, quando a tela puder oferecer um. */
  actionLabel: string | null;
  /** Se a tela pode oferecer "Tentar novamente" imediatamente. */
  retryable: boolean;
};

const CATALOG: Record<AppErrorCode, CatalogEntry> = {
  VALIDATION_ERROR: {
    status: 400,
    severity: "warning",
    title: "Dados incompletos",
    description: "Verifique os campos destacados e tente novamente.",
    actionLabel: null,
    retryable: false,
  },
  INVALID_CREDENTIALS: {
    status: 401,
    severity: "warning",
    title: "Usuário ou senha incorretos",
    description: "Verifique seus dados e tente novamente.",
    actionLabel: null,
    retryable: false,
  },
  ACCOUNT_INACTIVE: {
    status: 403,
    severity: "warning",
    title: "Acesso indisponível",
    description: "Seu usuário está inativo. Entre em contato com a equipe responsável.",
    actionLabel: null,
    retryable: false,
  },
  SESSION_EXPIRED: {
    status: 401,
    severity: "warning",
    title: "Sua sessão expirou",
    description: "Faça login novamente para continuar.",
    actionLabel: "Ir para login",
    retryable: false,
  },
  UNAUTHENTICATED: {
    status: 401,
    severity: "warning",
    title: "Sessão não encontrada",
    description: "Faça login para continuar.",
    actionLabel: "Ir para login",
    retryable: false,
  },
  FORBIDDEN: {
    status: 403,
    severity: "warning",
    title: "Acesso não permitido",
    description: "Você não tem permissão para executar esta ação.",
    actionLabel: null,
    retryable: false,
  },
  CSRF_INVALID: {
    status: 403,
    severity: "warning",
    title: "Requisição não autorizada",
    description: "Recarregue a página e tente novamente.",
    actionLabel: "Recarregar página",
    retryable: false,
  },
  NOT_FOUND: {
    status: 404,
    severity: "warning",
    title: "Registro não encontrado",
    description: "O item solicitado não existe ou foi removido.",
    actionLabel: null,
    retryable: false,
  },
  CONFLICT: {
    status: 409,
    severity: "warning",
    title: "Conflito de dados",
    description:
      "Este registro foi alterado por outra pessoa. Recarregue a página e tente novamente.",
    actionLabel: "Recarregar página",
    retryable: false,
  },
  RATE_LIMIT: {
    status: 429,
    severity: "warning",
    title: "Muitas tentativas de acesso",
    description:
      "Por segurança, seu acesso foi temporariamente limitado. Aguarde alguns minutos antes de tentar novamente.",
    // Sem "Tentar novamente": enquanto o bloqueio durar, nova requisição só piora.
    actionLabel: null,
    retryable: false,
  },
  SERVICE_UNAVAILABLE: {
    status: 503,
    severity: "critical",
    title: "Sistema temporariamente indisponível",
    description:
      "Não foi possível conectar aos serviços do sistema. Aguarde alguns instantes e tente novamente. Se o problema persistir, contate a equipe de TI.",
    actionLabel: "Tentar novamente",
    retryable: true,
  },
  INTERNAL_ERROR: {
    status: 500,
    severity: "critical",
    title: "Não foi possível concluir a operação",
    description:
      "Ocorreu uma falha interna. Tente novamente em alguns instantes ou contate a equipe de TI.",
    actionLabel: null,
    retryable: false,
  },
  NETWORK_ERROR: {
    // 0 = a requisição nem chegou ao servidor (o fetch rejeitou).
    status: 0,
    severity: "critical",
    title: "Falha de comunicação",
    description:
      "Não foi possível comunicar com o servidor. Verifique sua conexão e tente novamente.",
    actionLabel: "Tentar novamente",
    retryable: true,
  },
};

/** Ajustes de texto por superfície — evita duplicar o catálogo inteiro. */
const SURFACE_OVERRIDES: Partial<
  Record<ErrorSurface, Partial<Record<AppErrorCode, Partial<CatalogEntry>>>>
> = {
  login: {
    INTERNAL_ERROR: { title: "Não foi possível concluir o acesso" },
  },
};

export function isAppErrorCode(value: unknown): value is AppErrorCode {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CATALOG, value);
}

/** Código padrão para um status HTTP — usado quando o backend não mandou um
 *  code conhecido (rotas legadas que devolvem apenas uma frase em `error`). */
export function codeFromStatus(status: number | null | undefined): AppErrorCode {
  switch (status) {
    case 400:
      return "VALIDATION_ERROR";
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "RATE_LIMIT";
    case 503:
      return "SERVICE_UNAVAILABLE";
    default:
      return "INTERNAL_ERROR";
  }
}

/** Heurística: o valor parece um CÓDIGO técnico (SCREAMING_SNAKE_CASE)?
 *  Serve para NUNCA exibir um código desconhecido como se fosse mensagem. */
export function looksLikeErrorCode(value: unknown): boolean {
  return typeof value === "string" && /^[A-Z][A-Z0-9_]*$/.test(value.trim());
}

export type ErrorContext = {
  /** Segundos até poder tentar de novo (429). */
  retryAfterSeconds?: number | null;
  /** Correlation id do backend. Serve para casar a resposta com o log do
   *  servidor — NÃO é exibido ao usuário final. */
  requestId?: string | null;
  /** Status HTTP da resposta — usado quando o `code` é desconhecido. */
  status?: number | null;
  /** `message` amigável vinda do servidor; usada quando o `code` é desconhecido. */
  fallbackMessage?: string | null;
  /** Quando true, a `message` do servidor tem prioridade sobre o catálogo.
   *  Use em telas genéricas, onde a rota costuma mandar um texto específico
   *  ("Nome já cadastrado."). Telas com texto padronizado (login) devem deixar
   *  false para que o catálogo mande. */
  preferServerMessage?: boolean;
  surface?: ErrorSurface;
};

export type FriendlyError = {
  code: AppErrorCode;
  severity: ErrorSeverity;
  title: string;
  description: string;
  actionLabel: string | null;
  retryable: boolean;
  /** Segundos restantes de bloqueio, ou null. */
  retryAfterSeconds: number | null;
  /** Frase estática do tempo restante ("aproximadamente 8 minutos"), ou null. */
  retryHint: string | null;
};

/**
 * Traduz um código técnico para a mensagem exibível.
 *
 * Regras:
 * - `code` conhecido vence;
 * - `code` desconhecido cai para o código derivado do status HTTP;
 * - a `message` do servidor só vira descrição quando NÃO parece um código
 *   técnico — assim "RATE_LIMIT"/"INTERNAL_ERROR" nunca chegam à tela.
 */
export function getUserFriendlyError(
  code: string | null | undefined,
  context: ErrorContext = {},
): FriendlyError {
  const resolved: AppErrorCode = isAppErrorCode(code) ? code : codeFromStatus(context.status);
  const base = CATALOG[resolved];
  const override = SURFACE_OVERRIDES[context.surface ?? "generic"]?.[resolved] ?? {};
  const entry: CatalogEntry = { ...base, ...override };

  // A `message` do servidor só pode virar descrição se NÃO for um código
  // técnico — é isso que impede "RATE_LIMIT"/"INTERNAL_ERROR" de chegar à tela.
  const serverMessage = context.fallbackMessage?.trim();
  const serverMessageUsable = !!serverMessage && !looksLikeErrorCode(serverMessage);
  const useServerMessage =
    serverMessageUsable && (context.preferServerMessage === true || !isAppErrorCode(code));

  const retryAfterSeconds =
    typeof context.retryAfterSeconds === "number" && context.retryAfterSeconds > 0
      ? Math.ceil(context.retryAfterSeconds)
      : null;

  return {
    code: resolved,
    severity: entry.severity,
    title: entry.title,
    description: useServerMessage && serverMessage ? serverMessage : entry.description,
    actionLabel: entry.actionLabel,
    retryable: entry.retryable,
    retryAfterSeconds,
    retryHint: retryAfterSeconds !== null ? describeRetryDelay(retryAfterSeconds) : null,
  };
}

/** Status HTTP canônico de um código — usado pelo backend ao montar a resposta. */
export function statusForCode(code: AppErrorCode): number {
  return CATALOG[code].status;
}

/** "08:42" — contador regressivo. Minutos podem passar de 59. */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** "13 min 07 s" — tempo restante por extenso, para a mensagem do alerta.
 *  Abaixo de 1 minuto mostra só os segundos ("47 s"). */
export function formatRetryDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (minutes === 0) return `${seconds} s`;
  return `${minutes} min ${String(seconds).padStart(2, "0")} s`;
}

/** "aproximadamente 8 minutos" — frase estática, sem contador. */
export function describeRetryDelay(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  if (safe < 60) return "alguns segundos";
  const minutes = Math.ceil(safe / 60);
  return `aproximadamente ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}
