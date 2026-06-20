// Proteção CSRF para route handlers de escrita (POST/PATCH/PUT/DELETE).
//
// Estratégia (defesa em profundidade): validação de Origin + header customizado
// obrigatório. Um <form> HTML cross-site consegue disparar um POST com cookies,
// mas NÃO consegue definir cabeçalhos customizados nem forjar o Origin — só
// código JS na própria origem (sujeito à same-origin policy) faz as duas coisas.
//
// Integra-se ao contrato de erros existente: lança HttpError(403, ...,
// "CSRF_INVALID"), que o `fail()` serializa como { error, message }.

import type { NextRequest } from "next/server";
import { HttpError } from "./guards";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Origens legítimas. Vercel define VERCEL_URL/VERCEL_PROJECT_PRODUCTION_URL
 *  sem protocolo; em dev liberamos localhost. Pode-se ampliar via
 *  APP_ALLOWED_ORIGINS (lista separada por vírgula). */
function allowedOrigins(): Set<string> {
  const origins = new Set<string>([
    "https://projetos-tsteck.vercel.app",
  ]);

  for (const envVar of ["VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL"]) {
    const host = process.env[envVar];
    if (host) origins.add(`https://${host}`);
  }

  for (const extra of (process.env.APP_ALLOWED_ORIGINS ?? "").split(",")) {
    const v = extra.trim();
    if (v) origins.add(v);
  }

  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }

  return origins;
}

/** Valida a origem de uma requisição de escrita. Lança HttpError(403) se
 *  inválida; não faz nada para métodos seguros (GET/HEAD/OPTIONS). */
export function requireSameOrigin(req: NextRequest): void {
  const method = req.method.toUpperCase();
  if (SAFE_METHODS.has(method)) return;

  const origin = req.headers.get("origin");
  if (!origin || !allowedOrigins().has(origin)) {
    throw new HttpError(403, "Origem não autorizada.", "CSRF_INVALID");
  }

  // Header customizado: requisições fetch/XHR da própria app sempre podem
  // enviá-lo; formulários HTML cross-origin tradicionais não conseguem.
  if (req.headers.get("x-requested-with") !== "XMLHttpRequest") {
    throw new HttpError(403, "Cabeçalho de verificação ausente.", "CSRF_INVALID");
  }
}
