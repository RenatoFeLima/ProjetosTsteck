// Health check para monitoramento externo.
//
// Deliberadamente minimalista: responde APENAS "ok" ou "degraded". Não expõe
// host, database, usuário do banco, versão, driver, tokens nem qualquer outro
// detalhe de infraestrutura — é um endpoint público.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { status: 200, headers: HEADERS });
  } catch (error) {
    // Detalhe técnico só no log do servidor.
    console.error("[health] banco indisponível:", error);
    return NextResponse.json({ status: "degraded" }, { status: 503, headers: HEADERS });
  }
}
