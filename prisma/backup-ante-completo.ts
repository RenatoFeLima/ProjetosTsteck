// Backup completo dos projetos de ante-projeto e todas as tabelas relacionadas.
// Salva arquivos JSON separados na pasta prisma/backups/.
// Rodar: npm run db:backup-ante-completo
import { PrismaClient } from "@prisma/client";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

async function main() {
  const prisma = new PrismaClient();
  const today = new Date().toISOString().slice(0, 10);
  const dir = join("prisma", "backups", today);
  mkdirSync(dir, { recursive: true });

  try {
    // 1. Buscar IDs dos projetos nos 3 status alvo
    const projects = await prisma.project.findMany({
      where: {
        status: { in: ["ELABORAR_ANTE_PROJETO", "ANTE_PROJETO_ENVIADO", "ANTE_PROJETO_APROVADO"] },
      },
      orderBy: { status: "asc" },
    });
    const ids = projects.map((p) => p.id);
    console.log(`Projetos encontrados: ${ids.length}`);

    // 2. Project (com campos serializados)
    const projectsJson = JSON.stringify(projects, dateReplacer, 2);
    writeFileSync(join(dir, `backup-projects-ante-${today}.json`), projectsJson);
    console.log(`✅ Projects: ${projects.length} registros`);

    // 3. ProjectStatusHistory
    const history = await prisma.projectStatusHistory.findMany({
      where: { projectId: { in: ids } },
      orderBy: [{ projectId: "asc" }, { enteredAt: "asc" }],
    });
    writeFileSync(join(dir, `backup-history-ante-${today}.json`), JSON.stringify(history, dateReplacer, 2));
    console.log(`✅ StatusHistory: ${history.length} registros`);

    // 4. ProjectObservation
    const observations = await prisma.projectObservation.findMany({
      where: { projectId: { in: ids } },
      orderBy: [{ projectId: "asc" }, { createdAt: "asc" }],
    });
    writeFileSync(join(dir, `backup-observations-ante-${today}.json`), JSON.stringify(observations, dateReplacer, 2));
    console.log(`✅ Observations: ${observations.length} registros`);

    // 5. ProjectNotification
    const notifications = await prisma.projectNotification.findMany({
      where: { projectId: { in: ids } },
      orderBy: [{ projectId: "asc" }, { createdAt: "asc" }],
    });
    writeFileSync(join(dir, `backup-notifications-ante-${today}.json`), JSON.stringify(notifications, dateReplacer, 2));
    console.log(`✅ Notifications: ${notifications.length} registros`);

    // 6. ProjectReviewStudyHistory
    const reviewStudy = await prisma.projectReviewStudyHistory.findMany({
      where: { projectId: { in: ids } },
      orderBy: [{ projectId: "asc" }, { enteredAt: "asc" }],
    });
    writeFileSync(join(dir, `backup-review-study-ante-${today}.json`), JSON.stringify(reviewStudy, dateReplacer, 2));
    console.log(`✅ ReviewStudyHistory: ${reviewStudy.length} registros`);

    // 7. ProjectFinalReviewHistory
    const finalReview = await prisma.projectFinalReviewHistory.findMany({
      where: { projectId: { in: ids } },
      orderBy: [{ projectId: "asc" }, { enteredAt: "asc" }],
    });
    writeFileSync(join(dir, `backup-final-review-ante-${today}.json`), JSON.stringify(finalReview, dateReplacer, 2));
    console.log(`✅ FinalReviewHistory: ${finalReview.length} registros`);

    // Sumário
    console.log("\n═══════════════════════════════════");
    console.log(`Backup completo salvo em: ${dir}`);
    console.log(`  Projects:          ${projects.length}`);
    console.log(`  StatusHistory:     ${history.length}`);
    console.log(`  Observations:      ${observations.length}`);
    console.log(`  Notifications:     ${notifications.length}`);
    console.log(`  ReviewStudy:       ${reviewStudy.length}`);
    console.log(`  FinalReview:       ${finalReview.length}`);
    console.log("═══════════════════════════════════");

    // Distribuição por status
    const byStatus: Record<string, number> = {};
    for (const p of projects) byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;
    console.log("\nDistribuição:");
    for (const [st, n] of Object.entries(byStatus)) console.log(`  ${String(n).padStart(4)}  ${st}`);

  } finally {
    await prisma.$disconnect();
  }
}

function dateReplacer(_: string, v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return v.toString();
  return v;
}

main().catch((e) => { console.error(e); process.exit(1); });
