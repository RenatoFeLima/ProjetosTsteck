// Helpers para route handlers: respostas JSON padronizadas e mapeamento de erros.

import { NextResponse } from "next/server";
import { HttpError } from "./auth/guards";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/** Converte exceções em resposta JSON com status apropriado. */
export function fail(error: unknown) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("[api] erro não tratado:", error);
  return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
}
