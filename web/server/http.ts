// Helpers para route handlers: respostas JSON padronizadas e mapeamento de erros.
//
// Contrato de erro (ADITIVO — `error` e `message` continuam existindo para não
// quebrar as rotas e telas já existentes):
//
//   {
//     "error":   "<CODE>",   // alias legado de `code`
//     "code":    "<CODE>",
//     "message": "<mensagem amigável>",
//     "requestId": "8F2C-91A4",     // só em 500/503
//     "retryAfterSeconds": 420       // só quando aplicável (429)
//   }
//
// A tradução do código para o texto exibido é responsabilidade do catálogo em
// lib/errors/error-catalog.ts — o backend nunca manda detalhe técnico para a UI.

import { NextResponse } from "next/server";
import { HttpError } from "./auth/guards";
import { isDatabaseUnavailableError } from "./errors/database-errors";
import { newRequestId, REQUEST_ID_HEADER } from "./errors/request-id";
import { statusForCode, type AppErrorCode } from "@/lib/errors/error-catalog";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/** Código de erro estável derivado do status HTTP (contrato com o frontend). */
function defaultCode(status: number): string {
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
      return status >= 500 ? "INTERNAL_ERROR" : "ERROR";
  }
}

export type ErrorResponseInit = {
  code: AppErrorCode;
  /** Mensagem amigável. Omita para deixar a UI resolver pelo catálogo. */
  message?: string;
  /** Sobrescreve o status canônico do código. */
  status?: number;
  /** Código de atendimento. Gerado automaticamente em 500/503 quando ausente. */
  requestId?: string | null;
  retryAfterSeconds?: number | null;
  headers?: Record<string, string>;
};

/** Monta uma resposta de erro no contrato padrão. Use nas rotas que precisam
 *  devolver um código específico (ex.: RATE_LIMIT, SERVICE_UNAVAILABLE). */
export function errorResponse(init: ErrorResponseInit) {
  const status = init.status ?? statusForCode(init.code);
  const needsRequestId = status >= 500;
  const requestId = init.requestId ?? (needsRequestId ? newRequestId() : null);

  // Calculado UMA vez e reusado no header e no body — eles nunca podem divergir.
  const retryAfter =
    typeof init.retryAfterSeconds === "number"
      ? Math.max(0, Math.ceil(init.retryAfterSeconds))
      : null;

  const body: Record<string, unknown> = {
    error: init.code, // alias legado
    code: init.code,
  };
  if (init.message) body.message = init.message;
  if (requestId) body.requestId = requestId;
  if (retryAfter !== null) body.retryAfterSeconds = retryAfter;

  const headers: Record<string, string> = { ...init.headers };
  if (requestId) headers[REQUEST_ID_HEADER] = requestId;
  if (retryAfter !== null) headers["Retry-After"] = String(retryAfter);

  return NextResponse.json(body, { status, headers });
}

/**
 * Resposta de erro a partir de uma exceção.
 *
 * - `HttpError` → status/código/mensagem que o próprio guard definiu;
 * - indisponibilidade conhecida do banco → 503 SERVICE_UNAVAILABLE;
 * - qualquer outra coisa → 500 INTERNAL_ERROR (é bug, não infraestrutura).
 *
 * O erro técnico (com stack) fica SOMENTE no log do servidor, prefixado pelo
 * código de atendimento para casar com o que o usuário vê na tela.
 */
export function fail(error: unknown) {
  if (error instanceof HttpError) {
    const code = error.code ?? defaultCode(error.status);
    const requestId = error.status >= 500 ? newRequestId() : null;
    if (requestId) console.error(`[api][${requestId}] ${code}:`, error);

    const body: Record<string, unknown> = {
      error: code,
      code,
      message: error.message,
    };
    if (requestId) body.requestId = requestId;

    return NextResponse.json(body, {
      status: error.status,
      headers: requestId ? { [REQUEST_ID_HEADER]: requestId } : undefined,
    });
  }

  const requestId = newRequestId();

  if (isDatabaseUnavailableError(error)) {
    console.error(`[api][${requestId}] SERVICE_UNAVAILABLE — banco indisponível:`, error);
    return errorResponse({
      code: "SERVICE_UNAVAILABLE",
      message: "Sistema temporariamente indisponível.",
      requestId,
    });
  }

  console.error(`[api][${requestId}] erro não tratado:`, error);
  return errorResponse({
    code: "INTERNAL_ERROR",
    message: "Erro interno do servidor.",
    requestId,
  });
}
