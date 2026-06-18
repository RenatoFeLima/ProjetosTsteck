// Reimportação Excel/CSV de projetos (arquivo exportado pelo próprio sistema).
// Atualiza SOMENTE projetos existentes, casando por "ID do Projeto" (fallback:
// código único → construtora+obra único). Não cria, não deleta, não altera
// status, não cria mestres, não envia e-mail.
//
// Fluxo: dry-run (sem gravar) + commit em LOTES com backup obrigatório no
// primeiro lote (espelha o finalProjectsImportService para evitar 504).

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { assertPermission, HttpError } from "@/server/auth/guards";
import type { SessionUser } from "@/server/auth/session";
import { writeAudit } from "./auditService";
import { parseCsvToObjectsWithDiag } from "@/features/import/domain/csv";
import { normalizeName, normalizeCode } from "@/features/import/domain/import-normalize";
import { ID_HEADER } from "@/features/projects/domain/project-export";
import {
  analyzeProjectsExcel,
  excelWorkKey,
  stripDots,
  normalizeCabin,
  type ExcelMatchSnapshot,
  type ExcelSnapshotProject,
  type ExcelMatchPlan,
} from "@/features/import/domain/projects-excel-match";
import type {
  ProjectsExcelImportReport,
  ProjectsExcelBackup,
  ProjectsExcelBatchResult,
} from "@/features/import/domain/projects-excel-import-types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const SNAPSHOT_INCLUDE = {
  builder: { select: { name: true } },
  work: { select: { name: true } },
  seller: { select: { name: true } },
  equipment: { select: { code: true } },
  cabinType: { select: { name: true } },
  observations: { select: { text: true } },
} as any;

function isoDate(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function pushTo(map: Map<string, ExcelSnapshotProject[]>, key: string, value: ExcelSnapshotProject): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

async function loadSnapshot(): Promise<ExcelMatchSnapshot> {
  const [projects, sellers, equipment, cabinTypes] = await Promise.all([
    prisma.project.findMany({ include: SNAPSHOT_INCLUDE }) as Promise<any[]>,
    prisma.seller.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.equipment.findMany({ where: { active: true }, select: { id: true, code: true } }),
    prisma.cabinType.findMany({ where: { active: true }, select: { id: true, name: true } }),
  ]);

  const byId = new Map<string, ExcelSnapshotProject>();
  const byCode = new Map<string, ExcelSnapshotProject[]>();
  const byWork = new Map<string, ExcelSnapshotProject[]>();
  const codeOwner = new Map<string, string>();

  for (const p of projects) {
    const entry: ExcelSnapshotProject = {
      id: p.id,
      code: p.code,
      status: p.status,
      constructorName: p.builder?.name ?? null,
      workName: p.work?.name ?? null,
      sellerName: p.seller?.name ?? null,
      equipmentCode: p.equipment?.code ?? null,
      cabinTypeName: p.cabinType?.name ?? null,
      engineerName: p.engineerName ?? null,
      engineerPhone: p.engineerPhone ?? null,
      dataLancamento: isoDate(p.createdAt),
      projetoObraRecebido: !!p.projectReceived,
      localCabineDefinido: !!p.cabinLocationDefined,
      alinhamentoConcluido: !!p.alignmentCompleted,
      dataAlinhamento: isoDate(p.alignmentDate),
      urgente: p.priority === "URGENTE",
      prazoUrgencia: isoDate(p.urgentDeadline),
      motivoUrgencia: p.urgentReason ?? null,
      observationTexts: (p.observations as { text: string }[]).map((o) => normalizeName(o.text)),
    };
    byId.set(p.id, entry);
    const cu = p.code.trim().toUpperCase();
    codeOwner.set(cu, p.id);
    pushTo(byCode, cu, entry);
    if (entry.constructorName && entry.workName) {
      pushTo(byWork, excelWorkKey(entry.constructorName, entry.workName), entry);
    }
  }

  const sellersMap = new Map<string, { id: string; displayName: string }>();
  sellers.forEach((s) => sellersMap.set(stripDots(normalizeName(s.name)), { id: s.id, displayName: s.name }));
  const equipmentMap = new Map<string, { id: string; displayName: string }>();
  equipment.forEach((e) => equipmentMap.set(normalizeCode(e.code), { id: e.id, displayName: e.code }));
  const cabinTypesMap = new Map<string, { id: string; displayName: string }>();
  cabinTypes.forEach((c) => cabinTypesMap.set(normalizeCabin(c.name), { id: c.id, displayName: c.name }));

  return { byId, byCode, byWork, codeOwner, sellers: sellersMap, equipment: equipmentMap, cabinTypes: cabinTypesMap };
}

function emptyReport(diag: ProjectsExcelImportReport["diagnostic"]): ProjectsExcelImportReport {
  return {
    dryRun: true,
    diagnostic: diag,
    rowsRead: 0,
    matched: [],
    notFound: [],
    conflicts: [],
    duplicateCodes: [],
    invalidRows: [],
    sellersNotFound: [],
    equipmentNotFound: [],
    cabinTypesNotFound: [],
  };
}

function buildReport(csvText: string, snap: ExcelMatchSnapshot) {
  const { rows, diag } = parseCsvToObjectsWithDiag(csvText);
  if (!diag.delimiter) {
    throw new HttpError(400, "Não foi possível identificar o separador do CSV. Use vírgula (,), ponto-e-vírgula (;) ou tab.");
  }
  const report = emptyReport({
    delimiter: diag.delimiter,
    delimiterLabel: diag.delimiterLabel,
    columns: diag.columns,
    hasIdColumn: diag.columns.includes(ID_HEADER),
  });
  report.rowsRead = rows.length;
  return analyzeProjectsExcel(rows, snap, report);
}

// ─── Dry-run ───────────────────────────────────────────────────────────────────

export async function dryRunProjectsExcel(actor: SessionUser, csvText: string): Promise<ProjectsExcelImportReport> {
  requireImporter(actor);
  ensureContent(csvText);
  const snap = await loadSnapshot();
  const { report } = buildReport(csvText, snap);
  report.dryRun = true;
  return report;
}

// ─── Backup ──────────────────────────────────────────────────────────────────────

function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `backup-before-projects-excel-import-${stamp}.json`;
}

async function buildBackup(actor: SessionUser, plan: ExcelMatchPlan, projectsBefore: number, now: Date): Promise<ProjectsExcelBackup> {
  const ids = plan.updates.map((u) => u.projectId);
  const rows = ids.length
    ? await prisma.project.findMany({
        where: { id: { in: ids } },
        select: {
          id: true, code: true, status: true, sellerId: true, equipmentId: true, cabinTypeId: true,
          engineerName: true, engineerPhone: true, projectReceived: true, cabinLocationDefined: true,
          alignmentCompleted: true, alignmentDate: true, priority: true, urgentDeadline: true,
          urgentReason: true, updatedAt: true,
        },
      })
    : [];
  return {
    fileName: backupFileName(now),
    createdAt: now.toISOString(),
    createdBy: actor.name,
    projectsBefore,
    projects: rows.map((r) => ({
      ...r,
      alignmentDate: r.alignmentDate ? r.alignmentDate.toISOString() : null,
      urgentDeadline: r.urgentDeadline ? r.urgentDeadline.toISOString() : null,
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
}

// ─── Commit em lotes ───────────────────────────────────────────────────────────

const DEFAULT_CHUNK = 50;
const MAX_CHUNK = 100;

export async function commitProjectsExcelBatch(
  actor: SessionUser,
  csvText: string,
  offset: number,
  chunkSize: number,
): Promise<ProjectsExcelBatchResult> {
  requireImporter(actor);
  ensureContent(csvText);

  const size = Math.min(Math.max(1, Math.floor(chunkSize) || DEFAULT_CHUNK), MAX_CHUNK);
  const start = Math.max(0, Math.floor(offset) || 0);

  const snap = await loadSnapshot();
  const { plan } = buildReport(csvText, snap);
  const total = plan.updates.length;

  if (total === 0) throw new HttpError(400, "Nenhuma atualização segura encontrada. Revise o dry-run antes de confirmar.");
  if (start >= total) {
    return { total, offset: start, processed: 0, nextOffset: null, projectsUpdated: 0, codesUpdated: 0, observationsAdded: 0, errors: [], done: true };
  }

  const now = new Date();
  const result: ProjectsExcelBatchResult = {
    total, offset: start, processed: 0, nextOffset: null,
    projectsUpdated: 0, codesUpdated: 0, observationsAdded: 0, errors: [], done: false,
  };

  if (start === 0) {
    const projectsBefore = await prisma.project.count();
    try {
      result.backup = await buildBackup(actor, plan, projectsBefore, now);
    } catch (e) {
      throw new HttpError(500, `Falha ao gerar o backup obrigatório — commit abortado, nada foi alterado. (${e instanceof Error ? e.message : "erro"})`);
    }
  }

  const slice = plan.updates.slice(start, start + size);
  for (const u of slice) {
    try {
      await prisma.$transaction(
        async (tx) => {
          if (Object.keys(u.data).length > 0) {
            await tx.project.update({ where: { id: u.projectId }, data: { ...u.data, updatedById: actor.id } });
          }
          if (u.observationToAdd) {
            const existing = await tx.projectObservation.findFirst({ where: { projectId: u.projectId, text: u.observationToAdd }, select: { id: true } });
            if (!existing) {
              await tx.projectObservation.create({
                data: { id: randomUUID(), projectId: u.projectId, author: `Importação Excel (${actor.name})`, text: u.observationToAdd, createdAt: now },
              });
              result.observationsAdded += 1;
            }
          }
        },
        { timeout: 30_000 },
      );
      result.processed += 1;
      if (Object.keys(u.data).length > 0) result.projectsUpdated += 1;
      if (u.data.code) result.codesUpdated += 1;
    } catch (e) {
      result.errors.push({ projectId: u.projectId, detail: e instanceof Error ? e.message : "erro ao aplicar" });
    }
  }

  const next = start + size;
  result.nextOffset = next < total ? next : null;
  result.done = result.nextOffset === null;

  if (result.done) {
    await writeAudit({
      action: "PROJECTS_EXCEL_IMPORTED",
      actorUserId: actor.id,
      actorName: actor.name,
      entityType: "import",
      message: `${actor.name} concluiu a reimportação Excel de projetos (${total} no plano, lotes de ${size}).`,
      metadata: { total, chunkSize: size } as unknown as Prisma.InputJsonValue,
    });
  }

  return result;
}

// ─── Guards ────────────────────────────────────────────────────────────────────

function requireImporter(actor: SessionUser) {
  // Importação altera dados → permissão forte: ADMIN + edit.
  assertPermission(actor, (p) => p.projects.edit);
  if (actor.role !== "ADMIN") {
    throw new HttpError(403, "Apenas administradores podem importar atualizações de projetos.");
  }
}

function ensureContent(csvText: string) {
  if (!csvText?.trim()) throw new HttpError(400, "CSV vazio ou não enviado.");
}
