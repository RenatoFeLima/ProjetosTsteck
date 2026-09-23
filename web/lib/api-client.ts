// Wrapper único de fetch para as APIs internas (/api/*).
//
// Garante o header `X-Requested-With: XMLHttpRequest` exigido pela proteção CSRF
// do servidor (ver server/auth/csrf.ts). Enviar em TODAS as chamadas (inclusive
// GET) é inofensivo e evita esquecer em alguma mutação. `credentials: "same-origin"`
// mantém o cookie de sessão; Content-Type JSON é o padrão (sobrescrevível).

import { getUserFriendlyError } from "@/lib/errors/error-catalog";

export const CSRF_HEADER = { "X-Requested-With": "XMLHttpRequest" } as const;

/** Corpos que o browser precisa serializar com Content-Type próprio (multipart
 *  boundary, urlencoded). Hoje a app só envia JSON, mas isto evita que um futuro
 *  upload com FormData receba `application/json` indevidamente e quebre. */
function bodyHasOwnContentType(body: BodyInit | null | undefined): boolean {
  return (
    typeof FormData !== "undefined" && body instanceof FormData ||
    typeof Blob !== "undefined" && body instanceof Blob ||
    typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams
  );
}

/** fetch com cabeçalhos padrão da app (CSRF + JSON quando aplicável). Use para
 *  todo /api/*. Para FormData/Blob/URLSearchParams o Content-Type é deixado a
 *  cargo do browser (boundary correto); o header de CSRF é sempre enviado. */
export function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  // Headers() lida com qualquer forma de HeadersInit (objeto, array, Headers).
  const headers = new Headers(init.headers);
  if (!bodyHasOwnContentType(init.body) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("X-Requested-With", CSRF_HEADER["X-Requested-With"]);
  return fetch(url, { ...init, credentials: "same-origin", headers });
}

/** Erro de API já normalizado — o que a camada central precisa para traduzir. */
export type ApiErrorPayload = {
  /** Código técnico (`code`, com fallback no alias legado `error`). */
  code: string | null;
  /** Mensagem amigável enviada pelo servidor, quando houver. */
  message: string | null;
  /** Correlation id do backend (500/503) — uso interno, NÃO é exibido na UI. */
  requestId: string | null;
  /** Segundos de bloqueio (429). */
  retryAfterSeconds: number | null;
  status: number;
};

function toPositiveInt(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : null;
}

/** Extrai o erro de uma resposta já parseada, cobrindo o contrato novo
 *  ({ code, message, requestId, retryAfterSeconds }) e o legado ({ error }). */
export function readApiError(res: Response, data: unknown): ApiErrorPayload {
  const d = (data ?? {}) as {
    code?: unknown;
    error?: unknown;
    message?: unknown;
    requestId?: unknown;
    retryAfterSeconds?: unknown;
  };
  const code =
    typeof d.code === "string" ? d.code : typeof d.error === "string" ? d.error : null;

  return {
    code,
    message: typeof d.message === "string" ? d.message : null,
    requestId: typeof d.requestId === "string" ? d.requestId : res.headers.get("X-Request-ID"),
    retryAfterSeconds:
      toPositiveInt(d.retryAfterSeconds) ?? toPositiveInt(res.headers.get("Retry-After")),
    status: res.status,
  };
}

/** apiFetch + parse JSON + erro amigável passando pela camada central.
 *  Nunca lança com o CÓDIGO técnico como mensagem. */
export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const payload = readApiError(res, data);
    const friendly = getUserFriendlyError(payload.code, {
      status: payload.status,
      fallbackMessage: payload.message,
      requestId: payload.requestId,
      retryAfterSeconds: payload.retryAfterSeconds,
      // Telas genéricas: a frase específica da rota vence o texto do catálogo.
      preferServerMessage: true,
    });
    throw new Error(friendly.description);
  }
  return data as T;
}
