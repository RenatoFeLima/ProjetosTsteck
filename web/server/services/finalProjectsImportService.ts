// Enriquecimento de projetos FINAIS/APROVADOS via CSV.
// Completa projetos JÁ EXISTENTES nos status PROJETO_FINAL_ENVIADO e
// PROJETO_APROVADO, casando por CONSTRUTORA + OBRA (nunca por código).
//
// Regras de segurança (ver issue):
//   - Apenas ADMIN executa.
//   - NÃO cria projeto, NÃO deleta projeto, NÃO altera status.
//   - NÃO dispara e-mail/notificação.
//   - NÃO cria cadastro mestre automaticamente (match-only; campo pulado se ausente).
//   - Dry-run não toca o banco.
//   - Commit gera BACKUP obrigatório (snapshot dos projetos afetados) ANTES de
//     alterar — retornado na resposta e gravado no audit para rollback manual.
//     Se o backup falhar, o commit NÃO executa.

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertPermission, HttpError } from "@/server/auth/guards";
import type { SessionUser } from "@/server/auth/session";
import { writeAudit } from "./auditService";
import { parseCsvToObjectsWithDiag } from "@/features/import/domain/csv";
import { normalizeName, normalizeCode } from "@/features/import/domain/import-normalize";
import {
  analyzeFinalProjects,
  workKey,
  stripDots,
  normalizeCabin,
  FINAL_SCOPE_STATUSES,
  type MatchSnapshot,
  type SnapshotProject,
  type MatchPlan,
} from "@/features/import/domain/final-projects-match";
import type {
  FinalProjectsReport,
  FinalProjectsBackup,
} from "@/features/import/domain/final-projects-import-types";

// ─── Snapshot do banco ─────────────────────────────────────────────────────────

// `include` evita o overload tipado de `select` que colide com o model
// "Constructor" (relação `builder`). Linhas tipadas via `any` no map abaixo.
/* eslint-disable @typescript-eslint/no-explicit-any */
const SNAPSHOT_INCLUDE = {
  builder: { select: { name: true } },
  work: { select: { name: true } },
  seller: { select: { name: true } },
  equipment: { select: { code: true } },
  cabinType: { select: { name: true } },
  observations: { select: { text: true } },
} as any;

async function loadSnapshot(): Promise<MatchSnapshot> {
  const [projects, sellers, equipment, cabinTypes] = await Promise.all([
    prisma.project.findMany({ include: SNAPSHOT_INCLUDE }) as Promise<any[]>,
    prisma.seller.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.equipment.findMany({ where: { active: true }, select: { id: true, code: true } }),
    prisma.cabinType.findMany({ where: { active: true }, select: { id: true, name: true } }),
  ]);

  const projectsByWork = new Map<string, SnapshotProject[]>();
  const codeOwner = new Map<string, string>();

  for (const p of projects) {
    const construtora = p.builder?.name ?? "";
    const obra = p.work?.name ?? "";
    codeOwner.set(p.code.trim().toUpperCase(), p.id);
    if (!construtora || !obra) continue; // sem construtora/obra não há como casar
    const key = workKey(construtora, obra);
    const entry: SnapshotProject = {
      id: p.id,
      code: p.code,
      status: p.status,
      constructorName: construtora,
      workName: obra,
      sellerName: p.seller?.name ?? null,
      equipmentCode: p.equipment?.code ?? null,
      cabinTypeName: p.cabinType?.name ?? null,
      engineerName: p.engineerName ?? null,
      engineerPhone: p.engineerPhone ?? null,
      observationTexts: (p.observations as { text: string }[]).map((o) => normalizeName(o.text)),
    };
    const list = projectsByWork.get(key);
    if (list) list.push(entry);
    else projectsByWork.set(key, [entry]);
  }

  const sellersMap = new Map<string, { id: string; displayName: string }>();
  sellers.forEach((s) => sellersMap.set(stripDots(normalizeName(s.name)), { id: s.id, displayName: s.name }));

  const equipmentMap = new Map<string, { id: string; displayName: string }>();
  equipment.forEach((e) => equipmentMap.set(normalizeCode(e.code), { id: e.id, displayName: e.code }));

  const cabinTypesMap = new Map<string, { id: string; displayName: string }>();
  cabinTypes.forEach((c) => cabinTypesMap.set(normalizeCabin(c.name), { id: c.id, displayName: c.name }));

  return { projectsByWork, codeOwner, sellers: sellersMap, equipment: equipmentMap, cabinTypes: cabinTypesMap };
}

// ─── Relatório vazio ───────────────────────────────────────────────────────────

function emptyReport(diag: FinalProjectsReport["diagnostic"], projectsInScope: number): FinalProjectsReport {
  return {
    dryRun: true,
    diagnostic: diag,
    rowsRead: 0,
    projectsInScope,
    matched: [],
    notFound: [],
    conflicts: [],
    outOfScope: [],
    duplicateCodes: [],
    invalidRows: [],
    sellersNotFound: [],
    equipmentNotFound: [],
    cabinTypesNotFound: [],
  };
}

function countInScope(snap: MatchSnapshot): number {
  let n = 0;
  for (const list of snap.projectsByWork.values()) {
    n += list.filter((p) => (FINAL_SCOPE_STATUSES as readonly string[]).includes(p.status)).length;
  }
  return n;
}

function buildReport(csvText: string, snap: MatchSnapshot): { plan: MatchPlan; report: FinalProjectsReport } {
  const { rows, diag } = parseCsvToObjectsWithDiag(csvText);
  if (!diag.delimiter) {
    throw new HttpError(400, "Não foi possível identificar o separador do CSV. Use vírgula (,), ponto-e-vírgula (;) ou tab.");
  }
  const report = emptyReport(diag, countInScope(snap));
  report.rowsRead = rows.length;
  return analyzeFinalProjects(rows, snap, report);
}

// ─── Dry-run ───────────────────────────────────────────────────────────────────

export async function dryRunFinalProjectsImport(actor: SessionUser, csvText: string): Promise<FinalProjectsReport> {
  requireAdmin(actor);
  ensureContent(csvText);
  const snap = await loadSnapshot();
  const { report } = buildReport(csvText, snap);
  report.dryRun = true;
  return report;
}

// ─── Backup obrigatório ────────────────────────────────────────────────────────

function backupFileName(now: Date): string {
  // backup-before-final-project-enrichment-YYYY-MM-DD-HHmm.json
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `backup-before-final-project-enrichment-${stamp}.json`;
}

/** Snapshot do estado ANTERIOR dos projetos que serão tocados (rollback manual). */
async function buildBackup(
  actor: SessionUser,
  plan: MatchPlan,
  projectsBefore: number,
  now: Date,
): Promise<FinalProjectsBackup> {
  const ids = plan.updates.map((u) => u.projectId);
  const rows = ids.length
    ? await prisma.project.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          code: true,
          status: true,
          sellerId: true,
          equipmentId: true,
          cabinTypeId: true,
          engineerName: true,
          engineerPhone: true,
          updatedAt: true,
        },
      })
    : [];

  return {
    fileName: backupFileName(now),
    createdAt: now.toISOString(),
    createdBy: actor.name,
    projectsBefore,
    projects: rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() })),
  };
}

// ─── Commit ────────────────────────────────────────────────────────────────────

export async function commitFinalProjectsImport(actor: SessionUser, csvText: string): Promise<FinalProjectsReport> {
  requireAdmin(actor);
  ensureContent(csvText);
  const snap = await loadSnapshot();
  const { plan, report } = buildReport(csvText, snap);
  report.dryRun = false;

  if (plan.updates.length === 0) {
    throw new HttpError(400, "Nenhuma atualização segura encontrada. Revise o dry-run antes de confirmar.");
  }

  const now = new Date();
  const projectsBefore = await prisma.project.count();

  // 1) BACKUP OBRIGATÓRIO antes de qualquer escrita. Se falhar, aborta o commit.
  let backup: FinalProjectsBackup;
  try {
    backup = await buildBackup(actor, plan, projectsBefore, now);
  } catch (e) {
    throw new HttpError(
      500,
      `Falha ao gerar o backup obrigatório — commit abortado, nada foi alterado. (${e instanceof Error ? e.message : "erro"})`,
    );
  }

  let codesUpdated = 0;
  let observationsAdded = 0;

  // 2) Aplica em transação. Atualização campo-a-campo (Prisma ignora undefined).
  await prisma.$transaction(
    async (tx) => {
      for (const u of plan.updates) {
        if (Object.keys(u.data).length > 0) {
          await tx.project.update({
            where: { id: u.projectId },
            data: { ...u.data, updatedById: actor.id },
          });
          if (u.data.code) codesUpdated += 1;
        }
        if (u.observationToAdd) {
          await tx.projectObservation.create({
            data: {
              id: randomUUID(),
              projectId: u.projectId,
              author: `Importação Finais (${actor.name})`,
              text: u.observationToAdd,
              createdAt: now,
            },
          });
          observationsAdded += 1;
        }
      }
    },
    { timeout: 60_000 },
  );

  report.backup = backup;
  report.committed = {
    projectsUpdated: plan.updates.length,
    codesUpdated,
    observationsAdded,
    backupFile: backup.fileName,
    projectsBefore,
  };

  // 3) Audit com o backup completo (persistente — base do rollback).
  await writeAudit({
    action: "FINAL_PROJECTS_ENRICHED",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: "import",
    message:
      `${actor.name} enriqueceu ${plan.updates.length} projeto(s) finais/aprovados via CSV ` +
      `(${codesUpdated} código(s) atualizado(s), ${observationsAdded} observação(ões)). ` +
      `Backup: ${backup.fileName}.`,
    metadata: {
      backupFile: backup.fileName,
      projectsBefore,
      projectsUpdated: plan.updates.length,
      codesUpdated,
      observationsAdded,
      rowsRead: report.rowsRead,
      notFound: report.notFound.length,
      conflicts: report.conflicts.length,
      outOfScope: report.outOfScope.length,
      duplicateCodes: report.duplicateCodes.length,
      backup: backup.projects,
    } as unknown as Prisma.InputJsonValue,
  });

  return report;
}

// ─── Guards ────────────────────────────────────────────────────────────────────

function requireAdmin(actor: SessionUser) {
  assertPermission(actor, (p) => p.projects.edit);
  if (actor.role !== "ADMIN") {
    throw new HttpError(403, "Apenas administradores podem enriquecer projetos finais.");
  }
}

function ensureContent(csvText: string) {
  if (!csvText?.trim()) {
    throw new HttpError(400, "CSV vazio ou não enviado.");
  }
}
