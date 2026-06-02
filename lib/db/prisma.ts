// Prisma Client singleton — SOMENTE server-side.
// Evita esgotar conexões com hot-reload do Next em desenvolvimento (cada reload
// recriaria um PrismaClient). Em produção, uma única instância por processo.
//
// NUNCA importe este módulo em componentes client-side ("use client").
// Todo acesso ao banco deve passar por services / route handlers / server actions.

import { PrismaClient } from "@prisma/client";

if (typeof window !== "undefined") {
  throw new Error(
    "lib/db/prisma.ts foi importado no client-side. Prisma só pode rodar no servidor.",
  );
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
