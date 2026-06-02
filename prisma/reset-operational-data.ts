// Reset CONTROLADO dos dados operacionais.
// Uso manual: npm run db:reset-operational
//
// Preserva: estrutura/tabelas, _prisma_migrations, e o administrador inicial
// (INITIAL_ADMIN_USERNAME, padrão "RenatoFerreira") com role/permissões/hash/ativo.
// NÃO usa DROP TABLE nem `migrate reset`. Apaga só linhas, em ordem segura de FK.
//
// Flags:
//   CONFIRM_RESET_OPERATIONAL_DATA=true  → obrigatório quando NODE_ENV=production
//   RESET_INCLUDE_AUDIT=true             → também limpa AuditLog (default: preserva)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminUsername = process.env.INITIAL_ADMIN_USERNAME?.trim() || "RenatoFerreira";
  const isProd = process.env.NODE_ENV === "production";
  const confirmed = process.env.CONFIRM_RESET_OPERATIONAL_DATA === "true";
  const includeAudit = process.env.RESET_INCLUDE_AUDIT === "true";

  if (isProd && !confirmed) {
    console.error(
      "Operação bloqueada. Para limpar dados operacionais, defina CONFIRM_RESET_OPERATIONAL_DATA=true.",
    );
    process.exit(1);
  }

  // Confirma que o admin existe ANTES de qualquer coisa.
  const admin = await prisma.user.findUnique({ where: { username: adminUsername } });
  if (!admin) {
    console.error(
      `Admin "${adminUsername}" não encontrado. Abortando para não deixar o sistema sem administrador.`,
    );
    process.exit(1);
  }

  console.log(`🔒 Preservando admin: ${admin.name} (${admin.username}) — role ${admin.role}.`);
  console.log("🧹 Iniciando limpeza dos dados operacionais...\n");

  const report: Record<string, number> = {};
  const del = async (label: string, fn: () => Promise<{ count: number }>) => {
    const { count } = await fn();
    report[label] = count;
    console.log(`  • ${label}: ${count} removido(s)`);
  };

  // Ordem segura de FK (filhos → pais). Project tem FK p/ Work/Constructor/etc e User.
  await del("ProjectNotification", () => prisma.projectNotification.deleteMany());
  await del("ProjectObservation", () => prisma.projectObservation.deleteMany());
  await del("ProjectReviewStudyHistory", () => prisma.projectReviewStudyHistory.deleteMany());
  await del("ProjectFinalReviewHistory", () => prisma.projectFinalReviewHistory.deleteMany());
  await del("ProjectStatusHistory", () => prisma.projectStatusHistory.deleteMany());
  await del("Project", () => prisma.project.deleteMany());
  await del("Work", () => prisma.work.deleteMany());
  await del("Constructor", () => prisma.constructor.deleteMany());
  await del("Equipment", () => prisma.equipment.deleteMany());
  await del("CabinType", () => prisma.cabinType.deleteMany());
  await del("Seller", () => prisma.seller.deleteMany());
  await del("Engineer", () => prisma.engineer.deleteMany());

  if (includeAudit) {
    await del("AuditLog", () => prisma.auditLog.deleteMany());
  } else {
    console.log("  • AuditLog: preservado (use RESET_INCLUDE_AUDIT=true para limpar)");
  }

  // Remove todos os usuários EXCETO o admin principal.
  await del("User (exceto admin)", () =>
    prisma.user.deleteMany({ where: { username: { not: adminUsername } } }),
  );

  // Registra o próprio reset na auditoria (a menos que tudo tenha sido limpo).
  await prisma.auditLog.create({
    data: {
      action: "OPERATIONAL_DATA_RESET",
      actorUserId: admin.id,
      actorName: admin.name,
      message: `Reset operacional executado por ${admin.name}. Tabelas limpas: ${Object.keys(report).join(", ")}.`,
      metadataJson: report,
    },
  });

  // Sanidade final: admin permanece intacto.
  const after = await prisma.user.findUnique({ where: { username: adminUsername } });
  if (!after || after.role !== "ADMIN" || !after.active) {
    throw new Error("ERRO CRÍTICO: o admin não está mais íntegro após o reset!");
  }

  console.log("\n✅ Reset concluído. Admin preservado e íntegro. Estrutura e migrations intactas.");
  console.log("   Resumo:", report);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Falha no reset:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
