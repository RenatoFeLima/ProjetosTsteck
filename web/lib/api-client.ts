// Wrapper único de fetch para as APIs internas (/api/*).
//
// Garante o header `X-Requested-With: XMLHttpRequest` exigido pela proteção CSRF
// do servidor (ver server/auth/csrf.ts). Enviar em TODAS as chamadas (inclusive
// GET) é inofensivo e evita esquecer em alguma mutação. `credentials: "same-origin"`
// mantém o cookie de sessão; Content-Type JSON é o padrão (sobrescrevível).

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

/** apiFetch + parse JSON + erro amigável a partir de { error, message }. */
export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const d = data as { error?: string; message?: string };
    throw new Error(d.message ?? d.error ?? "Erro na requisição.");
  }
  return data as T;
}
