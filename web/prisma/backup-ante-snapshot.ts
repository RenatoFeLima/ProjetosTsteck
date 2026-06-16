// Script de backup: salva os projetos dos 3 status de ante-projeto antes da importação.
// Rodar: npm run db:backup-ante
import { PrismaClient } from "@prisma/client";
import { writeFileSync } from "fs";

async function main() {
  const prisma = new PrismaClient();
  try {
    const projects = await prisma.project.findMany({
      where: { status: { in: ["ELABORAR_ANTE_PROJETO", "ANTE_PROJETO_ENVIADO", "ANTE_PROJETO_APROVADO"] } },
      select: {
        id: true,
        code: true,
        status: true,
        priority: true,
        engineerName: true,
        deadline: true,
        constructorId: true,
        workId: true,
        sellerId: true,
        equipmentId: true,
        cabinTypeId: true,
        createdAt: true,
      },
      orderBy: { status: "asc" },
    });

    const json = JSON.stringify(projects, null, 2);
    const filename = `prisma/backup-ante-projeto-${new Date().toISOString().slice(0, 10)}.json`;
    writeFileSync(filename, json);
    console.log(`✅ Backup: ${projects.length} projetos gravados em ${filename}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
