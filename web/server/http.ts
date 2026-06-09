// Helpers para route handlers: respostas JSON padronizadas e mapeamento de erros.

import { NextResponse } from "next/server";
import { HttpError } from "./auth/guards";

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
    default:
      return status >= 500 ? "INTERNAL_ERROR" : "ERROR";
  }
}

// Resposta de erro padronizada: { error: <CÓDIGO>, message: <amigável> }.
// O frontend lê `message` (e cai para `error` em respostas legadas).
export function fail(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.code ?? defaultCode(error.status), message: error.message },
      { status: error.status },
    );
  }
  console.error("[api] erro não tratado:", error);
  return NextResponse.json(
    { error: "INTERNAL_ERROR", message: "Erro interno do servidor." },
    { status: 500 },
  );
}
