/**
 * Patch: marcar projectReceived, cabinLocationDefined e alignmentCompleted = true
 * em todos os projetos com status diferente de CADASTRO_INICIAL.
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx prisma/patch-flags-ante-projeto.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Conta quantos projetos precisam de patch.
  const toFix = await prisma.project.count({
    where: {
      status: { not: "CADASTRO_INICIAL" },
      OR: [
        { projectReceived: false },
        { cabinLocationDefined: false },
        { alignmentCompleted: false },
      ],
    },
  });

  console.log(`Projetos a corrigir: ${toFix}`);
  if (toFix === 0) {
    console.log("Nenhum projeto precisa de patch. Saindo.");
    return;
  }

  const result = await prisma.project.updateMany({
    where: {
      status: { not: "CADASTRO_INICIAL" },
      OR: [
        { projectReceived: false },
        { cabinLocationDefined: false },
        { alignmentCompleted: false },
      ],
    },
    data: {
      projectReceived: true,
      cabinLocationDefined: true,
      alignmentCompleted: true,
    },
  });

  console.log(`Patch aplicado: ${result.count} projeto(s) atualizados.`);

  // Validação pós-patch
  const remaining = await prisma.project.count({
    where: {
      status: { not: "CADASTRO_INICIAL" },
      OR: [
        { projectReceived: false },
        { cabinLocationDefined: false },
        { alignmentCompleted: false },
      ],
    },
  });

  if (remaining === 0) {
    console.log("Validação OK: 0 projetos com flags pendentes.");
  } else {
    console.error(`ERRO: Ainda restam ${remaining} projetos com flags pendentes!`);
    process.exit(1);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
