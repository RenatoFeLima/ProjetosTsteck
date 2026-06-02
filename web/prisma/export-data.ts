// Exporta TODOS os dados do banco para um JSON com timestamp (backup/rollback).
// Uso: npm run db:export-json   → grava em web/backups/export-<timestamp>.json
// Não apaga nada. Seguro rodar a qualquer momento.

import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const prisma = new PrismaClient();

async function main() {
  const data = {
    exportedAt: new Date().toISOString(),
    database: process.env.DATABASE_NAME ?? "(desconhecido)",
    tables: {
      users: await prisma.user.findMany(),
      constructors: await prisma.constructor.findMany(),
      works: await prisma.work.findMany(),
      equipments: await prisma.equipment.findMany(),
      cabinTypes: await prisma.cabinType.findMany(),
      sellers: await prisma.seller.findMany(),
      engineers: await prisma.engineer.findMany(),
      projects: await prisma.project.findMany(),
      projectStatusHistory: await prisma.projectStatusHistory.findMany(),
      projectReviewStudyHistory: await prisma.projectReviewStudyHistory.findMany(),
      projectFinalReviewHistory: await prisma.projectFinalReviewHistory.findMany(),
      projectObservations: await prisma.projectObservation.findMany(),
      projectNotifications: await prisma.projectNotification.findMany(),
      auditLogs: await prisma.auditLog.findMany(),
    },
  };

  const counts = Object.fromEntries(
    Object.entries(data.tables).map(([k, v]) => [k, (v as unknown[]).length]),
  );

  const dir = resolve(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = resolve(dir, `export-${stamp}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2), "utf8");

  console.log("📦 Backup gerado:", file);
  console.log("   Registros por tabela:", counts);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Falha no export:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
