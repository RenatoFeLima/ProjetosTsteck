// Patch de status — junho 2026.
// Corrige status e prioridade de projetos importados do legado conforme lista revisada.
// Idempotente: verifica o estado atual antes de atualizar.
// Execução: npm run db:patch-jun2026

import { PrismaClient, type Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

type StatusChange = {
  code: string;
  construtora: string;
  obra: string;
  toStatus: string;
  toPriority?: "URGENTE" | "NORMAL";
};

// Apenas as linhas com mudança REAL de status ou prioridade.
// Linhas onde STATUS ANTIGO == STATUS ATUAL foram omitidas (sem alteração necessária).
const CHANGES: StatusChange[] = [
  // 1. ALBINO NUNES — retrocede de APROVADO para FINAL ENVIADO
  { code: "CRE-POÇ-168",   construtora: "ALBINO NUNES",  obra: "POTENZA",                          toStatus: "PROJETO_FINAL_ENVIADO" },

  // 3. BENX — URGENTE! → ELABORAR + urgente
  { code: "CRE-BN1-5XX",   construtora: "BENX",          obra: "CONEGO 505",                       toStatus: "ELABORAR_ANTE_PROJETO", toPriority: "URGENTE" },

  // 10. CURY — retrocede de APROVADO para FINAL ENVIADO
  { code: "CRE-MAS-1511",  construtora: "CURY",          obra: "MAXIMO VILA MASCOTE - TA",         toStatus: "PROJETO_FINAL_ENVIADO" },

  // 11. CURY — avança de FINAL ENVIADO para APROVADO
  { code: "CRE-MAS-X1511", construtora: "CURY",          obra: "MAXIMO VILA MASCOTE - TB",         toStatus: "PROJETO_APROVADO",     toPriority: "NORMAL" },

  // 12. CURY — avança de FINAL ENVIADO para APROVADO
  { code: "CRE-CUR-20XX",  construtora: "CURY",          obra: "LIKE CAMPO LIMPO - TA - EQUIP. 01", toStatus: "PROJETO_APROVADO",    toPriority: "NORMAL" },

  // 13. CURY — URGENTE! → ELABORAR + urgente
  { code: "CRE-CID-20XX",  construtora: "CURY",          obra: "CIDADE MOOCA VENEZIA - T1",        toStatus: "ELABORAR_ANTE_PROJETO", toPriority: "URGENTE" },

  // 14. CURY — URGENTE! → ELABORAR + urgente
  { code: "CRE-CID-20X1",  construtora: "CURY",          obra: "CIDADE MOOCA VENEZIA - T2",        toStatus: "ELABORAR_ANTE_PROJETO", toPriority: "URGENTE" },

  // 23. CYRELA — URGENTE! → ELABORAR + urgente
  { code: "CRE-VIV-20XX",  construtora: "CYRELA",        obra: "VIVAZ CLUBE BARRA FUNDA - T4 - EQUIP. 1", toStatus: "ELABORAR_ANTE_PROJETO", toPriority: "URGENTE" },

  // 24. CYRELA — URGENTE! → ELABORAR + urgente
  { code: "CRE-VIV-20X1",  construtora: "CYRELA",        obra: "VIVAZ CLUBE BARRA FUNDA - T4 - EQUIP. 2", toStatus: "ELABORAR_ANTE_PROJETO", toPriority: "URGENTE" },

  // 42. EZTEC — URGENTE! → ELABORAR + urgente
  { code: "CRE-RES-20X4",  construtora: "EZTEC",         obra: "RESERVA SÃO CAETANO - TC - EQUIP. 1", toStatus: "ELABORAR_ANTE_PROJETO", toPriority: "URGENTE" },

  // 43. EZTEC — URGENTE! → ELABORAR + urgente
  { code: "CRE-RES-20X5",  construtora: "EZTEC",         obra: "RESERVA SÃO CAETANO - TC - EQUIP. 2", toStatus: "ELABORAR_ANTE_PROJETO", toPriority: "URGENTE" },
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("=== DRY-RUN (nada será gravado) ===\n");

  const now = new Date();
  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const change of CHANGES) {
    const project = await prisma.project.findUnique({
      where: { code: change.code },
      select: { id: true, code: true, status: true, priority: true },
    });

    if (!project) {
      console.warn(`  [NÃO ENCONTRADO] ${change.code} — ${change.construtora} / ${change.obra}`);
      notFound++;
      continue;
    }

    const statusChanged = project.status !== change.toStatus;
    const priorityChanged = change.toPriority !== undefined && project.priority !== change.toPriority;

    if (!statusChanged && !priorityChanged) {
      console.log(`  [SEM MUDANÇA]   ${change.code} → já está ${project.status} / ${project.priority}`);
      skipped++;
      continue;
    }

    const parts: string[] = [];
    if (statusChanged) parts.push(`status: ${project.status} → ${change.toStatus}`);
    if (priorityChanged) parts.push(`priority: ${project.priority} → ${change.toPriority}`);
    console.log(`  [${dryRun ? "SIMULADO" : "ATUALIZADO"}]   ${change.code} — ${parts.join(", ")}`);

    if (dryRun) { updated++; continue; }

    const updateData: Prisma.ProjectUpdateInput = {};
    if (statusChanged) {
      updateData.status = change.toStatus as never;
      updateData.currentStatusEnteredAt = now;
    }
    if (priorityChanged) {
      updateData.priority = change.toPriority as never;
    }

    await prisma.$transaction(async (tx) => {
      await tx.project.update({ where: { id: project.id }, data: updateData });

      if (statusChanged) {
        await tx.projectStatusHistory.create({
          data: {
            id: randomUUID(),
            projectId: project.id,
            fromStatus: project.status as never,
            toStatus: change.toStatus as never,
            enteredAt: now,
            source: "patch-status-jun2026",
            changedById: null,
          },
        });
      }
    });

    updated++;
  }

  console.log(`\nResumo: ${updated} ${dryRun ? "seria(m) atualizado(s)" : "atualizado(s)"}, ${skipped} sem mudança, ${notFound} não encontrado(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
