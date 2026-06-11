// Importação do legado (CSV) — Obras, Projetos em andamento e finalizados.
// Duas etapas: dry-run (relatório, sem gravar) e commit (grava em lote).
// Regras: nunca cria Construtora/Vendedor/Equipamento/Cabine (match-only, já
// cadastrados manualmente); Engenheiro é gravado inline no projeto (sem cadastro);
// não duplica obra (por construtora) nem projeto (por código); ANTE-PROJETO sem
// código recebe código provisório CRE-TMP-####. NÃO dispara e-mail/notificação.

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { assertPermission, HttpError } from "@/server/auth/guards";
import type { SessionUser } from "@/server/auth/session";
import { writeAudit } from "./auditService";
import { onlyDigits } from "@/features/master-data/lib/masks";
import { DB_TO_UI_STATUS, type DbStatus } from "@/features/projects/domain/project-status-map";
import { parseCsvToObjects } from "@/features/import/domain/csv";
import {
  normalizeName,
  normalizeCode,
  parseBoolPt,
  cleanEngineerName,
  parseDateBr,
} from "@/features/import/domain/import-normalize";
import { mapAnteStatus, cadastroInitialStatus } from "@/features/import/domain/legacy-mapping";
import type { ImportReport, ImportSource, RefNotFound } from "@/features/import/domain/import-types";

export type ImportFiles = { cadastroCsv?: string; anteCsv?: string };

// ─── Snapshot do banco (match-only, carregado em 1 round-trip por tabela) ─────

type Snapshot = {
  constructors: Map<string, { id: string; name: string }>; // normName -> construtora
  works: Map<string, string>; // `${constructorId}::${normObra}` -> workId
  sellers: Map<string, string>; // normName -> id
  equipment: Map<string, string>; // normCode -> id
  cabinTypes: Map<string, string>; // normName -> id
  engineers: Map<string, string>; // normName -> id
  codes: Set<string>; // códigos de projeto existentes (UPPER)
  maxTempSuffix: number;
};

async function loadSnapshot(): Promise<Snapshot> {
  const [constructors, works, sellers, equipment, cabinTypes, engineers, projects] = await Promise.all([
    prisma.constructor.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.work.findMany({ where: { active: true }, select: { id: true, name: true, constructorId: true } }),
    prisma.seller.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.equipment.findMany({ where: { active: true }, select: { id: true, code: true } }),
    prisma.cabinType.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.engineer.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.project.findMany({ select: { code: true } }),
  ]);

  const snap: Snapshot = {
    constructors: new Map(),
    works: new Map(),
    sellers: new Map(),
    equipment: new Map(),
    cabinTypes: new Map(),
    engineers: new Map(),
    codes: new Set(),
    maxTempSuffix: 0,
  };
  constructors.forEach((c) => snap.constructors.set(normalizeName(c.name), c));
  works.forEach((w) => snap.works.set(`${w.constructorId}::${normalizeName(w.name)}`, w.id));
  sellers.forEach((s) => snap.sellers.set(normalizeName(s.name), s.id));
  equipment.forEach((e) => snap.equipment.set(normalizeCode(e.code), e.id));
  cabinTypes.forEach((c) => snap.cabinTypes.set(normalizeName(c.name), c.id));
  engineers.forEach((e) => snap.engineers.set(normalizeName(e.name), e.id));
  projects.forEach((p) => {
    const up = p.code.trim().toUpperCase();
    snap.codes.add(up);
    const m = up.match(/^CRE-TMP-(\d+)$/);
    if (m) snap.maxTempSuffix = Math.max(snap.maxTempSuffix, Number(m[1]));
  });
  return snap;
}

// ─── Plano (o que será gravado) ──────────────────────────────────────────────

type PlannedWork = { id: string; constructorId: string; name: string };

type PlannedProject = {
  id: string;
  code: string;
  constructorId: string;
  workId: string | null;
  sellerId: string | null;
  equipmentId: string | null;
  cabinTypeId: string | null;
  engineerId: string | null;
  engineerName: string | null;
  engineerPhone: string | null;
  status: DbStatus;
  priority: "NORMAL" | "URGENTE";
  projectReceived: boolean;
  cabinLocationDefined: boolean;
  alignmentCompleted: boolean;
  alignmentDate: Date | null;
  createdAt: Date;
  observation: string | null;
};

type Plan = { works: PlannedWork[]; projects: PlannedProject[] };

function emptyReport(): ImportReport {
  return {
    dryRun: true,
    rowsRead: { cadastroInicial: 0, anteProjeto: 0 },
    worksToCreate: [],
    worksExistingMatched: 0,
    worksDuplicateInFile: 0,
    projectsToCreate: [],
    projectsSkippedDuplicate: [],
    constructorsNotFound: [],
    sellersNotFound: [],
    equipmentNotFound: [],
    cabinTypesNotFound: [],
    engineersInline: [],
    tempCodesAssigned: 0,
    statusUrgentAssumed: [],
    dateErrors: [],
  };
}

/** Núcleo: transforma os CSVs + snapshot em um Plano + Relatório. Não grava. */
function analyze(files: ImportFiles, snap: Snapshot): { plan: Plan; report: ImportReport } {
  const report = emptyReport();
  const plan: Plan = { works: [], projects: [] };

  // Estado mutável do planejamento.
  const usedCodes = new Set(snap.codes); // evita duplicar contra banco e dentro do run
  const plannedWorkIdByKey = new Map<string, string>(); // key -> workId (novas obras do run)
  let tempSuffix = snap.maxTempSuffix;
  const engineersInline = new Set<string>();

  const nextTempCode = (): string => {
    let code: string;
    do {
      tempSuffix += 1;
      code = `CRE-TMP-${String(tempSuffix).padStart(4, "0")}`;
    } while (usedCodes.has(code));
    usedCodes.add(code);
    report.tempCodesAssigned += 1;
    return code;
  };

  // Resolve/planeja a Obra. Retorna workId (existente ou novo) ou null se a
  // construtora não existe (caller registra e pula a linha).
  const resolveWork = (
    construtoraRaw: string,
    obraRaw: string,
    source: ImportSource,
  ): { constructorId: string; workId: string | null } | null => {
    const cNorm = normalizeName(construtoraRaw);
    const constructor = snap.constructors.get(cNorm);
    if (!constructor) {
      report.constructorsNotFound.push({ construtora: construtoraRaw.trim(), obra: obraRaw.trim(), valor: construtoraRaw.trim(), source });
      return null;
    }
    const obra = obraRaw.trim();
    if (!obra) return { constructorId: constructor.id, workId: null };
    const key = `${constructor.id}::${normalizeName(obra)}`;
    const existing = snap.works.get(key);
    if (existing) {
      report.worksExistingMatched += 1;
      return { constructorId: constructor.id, workId: existing };
    }
    const planned = plannedWorkIdByKey.get(key);
    if (planned) {
      report.worksDuplicateInFile += 1;
      return { constructorId: constructor.id, workId: planned };
    }
    const id = randomUUID();
    plannedWorkIdByKey.set(key, id);
    plan.works.push({ id, constructorId: constructor.id, name: obra });
    report.worksToCreate.push({ construtora: constructor.name, obra });
    return { constructorId: constructor.id, workId: id };
  };

  const addRef = (arr: RefNotFound[], construtora: string, obra: string, valor: string, source: ImportSource) => {
    arr.push({ construtora: construtora.trim(), obra: obra.trim(), valor: valor.trim(), source });
  };

  // ── CADASTRO INICIAL ──
  if (files.cadastroCsv && files.cadastroCsv.trim()) {
    const rows = parseCsvToObjects(files.cadastroCsv);
    for (const r of rows) {
      const construtora = r["CONSTRUTORA"] ?? "";
      if (!construtora.trim()) continue;
      report.rowsRead.cadastroInicial += 1;
      const obra = r["OBRA"] ?? "";
      const source: ImportSource = "CADASTRO_INICIAL";

      const work = resolveWork(construtora, obra, source);
      if (!work) continue; // construtora ausente -> erro registrado, pula

      // Código: usa o do CSV; se vazio -> temp; se duplicado -> pula.
      const rawCode = (r["PROJETO"] ?? "").trim();
      let code: string;
      let temp = false;
      if (rawCode) {
        const up = rawCode.toUpperCase();
        if (usedCodes.has(up)) {
          report.projectsSkippedDuplicate.push({ code: rawCode, construtora: construtora.trim(), obra: obra.trim(), source, reason: "código já existe" });
          continue;
        }
        usedCodes.add(up);
        code = rawCode;
      } else {
        code = nextTempCode();
        temp = true;
      }

      // Referências (match-only).
      const vendedor = (r["VENDEDOR"] ?? "").trim();
      const equip = (r["EQUIP."] ?? "").trim();
      const cabine = (r["CABINE"] ?? "").trim();
      const sellerId = vendedor ? snap.sellers.get(normalizeName(vendedor)) ?? null : null;
      if (vendedor && !sellerId) addRef(report.sellersNotFound, construtora, obra, vendedor, source);
      const equipmentId = equip ? snap.equipment.get(normalizeCode(equip)) ?? null : null;
      if (equip && !equipmentId) addRef(report.equipmentNotFound, construtora, obra, equip, source);
      const cabinTypeId = cabine ? snap.cabinTypes.get(normalizeName(cabine)) ?? null : null;
      if (cabine && !cabinTypeId) addRef(report.cabinTypesNotFound, construtora, obra, cabine, source);

      const engName = cleanEngineerName(r["ENG. :"] ?? "");
      const engineerId = engName ? snap.engineers.get(normalizeName(engName)) ?? null : null;
      if (engName && !engineerId) engineersInline.add(engName);

      const projObra = parseBoolPt(r["PROJ OBRA"]) ?? false;
      const localCabine = parseBoolPt(r["LOCAL CABINE"]) ?? false;
      const alinhamento = parseBoolPt(r["ALINHAMENTO"]) ?? false;
      const status = cadastroInitialStatus(projObra, localCabine, alinhamento);

      // DATA LANÇ -> createdAt (a UI deriva data_lancamento de createdAt).
      const dl = parseDateBr(r["DATA LANÇ"]);
      let createdAt = new Date();
      if (!dl.ok) {
        report.dateErrors.push({ source, field: "DATA LANÇ", raw: dl.raw, construtora: construtora.trim(), obra: obra.trim() });
      } else if (dl.date) {
        createdAt = dl.date;
      }

      plan.projects.push({
        id: randomUUID(),
        code,
        constructorId: work.constructorId,
        workId: work.workId,
        sellerId,
        equipmentId,
        cabinTypeId,
        engineerId,
        engineerName: engName || null,
        engineerPhone: onlyDigits(r["CELULAR"]) || null,
        status,
        priority: "NORMAL",
        projectReceived: projObra,
        cabinLocationDefined: localCabine,
        alignmentCompleted: alinhamento,
        alignmentDate: null,
        createdAt,
        observation: (r["OBSERVAÇÕES"] ?? "").trim() || null,
      });
      report.projectsToCreate.push({ code, construtora: construtora.trim(), obra: obra.trim(), status, statusLabel: DB_TO_UI_STATUS[status], temp, urgente: false, source });
    }
  }

  // ── ANTE-PROJETO (sem código -> sempre temp) ──
  if (files.anteCsv && files.anteCsv.trim()) {
    const rows = parseCsvToObjects(files.anteCsv);
    for (const r of rows) {
      const construtora = r["CONSTRUTORA"] ?? "";
      if (!construtora.trim()) continue;
      report.rowsRead.anteProjeto += 1;
      const obra = r["OBRA"] ?? "";
      const source: ImportSource = "ANTE_PROJETO";

      const work = resolveWork(construtora, obra, source);
      if (!work) continue;

      const st = mapAnteStatus(r["STATUS"] ?? "");
      if (!st.ok) {
        report.projectsSkippedDuplicate.push({ code: "(sem código)", construtora: construtora.trim(), obra: obra.trim(), source, reason: `status não reconhecido: "${st.raw}"` });
        continue;
      }
      if (st.assumed) report.statusUrgentAssumed.push({ construtora: construtora.trim(), obra: obra.trim() });

      const engName = cleanEngineerName(r["ENGENHEIRO"] ?? "");
      const engineerId = engName ? snap.engineers.get(normalizeName(engName)) ?? null : null;
      if (engName && !engineerId) engineersInline.add(engName);

      // DATA PREV -> createdAt (sem DATA LANÇ neste arquivo).
      const dp = parseDateBr(r["DATA PREV"]);
      let createdAt = new Date();
      if (!dp.ok) {
        report.dateErrors.push({ source, field: "DATA PREV", raw: dp.raw, construtora: construtora.trim(), obra: obra.trim() });
      } else if (dp.date) {
        createdAt = dp.date;
      }

      const code = nextTempCode();
      plan.projects.push({
        id: randomUUID(),
        code,
        constructorId: work.constructorId,
        workId: work.workId,
        sellerId: null,
        equipmentId: null,
        cabinTypeId: null,
        engineerId,
        engineerName: engName || null,
        engineerPhone: null,
        status: st.status,
        priority: st.urgente ? "URGENTE" : "NORMAL",
        projectReceived: false,
        cabinLocationDefined: false,
        alignmentCompleted: false,
        alignmentDate: null,
        createdAt,
        observation: (r["OBSERVAÇÃO"] ?? "").trim() || null,
      });
      report.projectsToCreate.push({ code, construtora: construtora.trim(), obra: obra.trim(), status: st.status, statusLabel: DB_TO_UI_STATUS[st.status], temp: true, urgente: st.urgente, source });
    }
  }

  report.engineersInline = [...engineersInline].sort();
  return { plan, report };
}

// ─── Etapa 1: dry-run ─────────────────────────────────────────────────────────

export async function dryRunImport(actor: SessionUser, files: ImportFiles): Promise<ImportReport> {
  requireAdmin(actor);
  ensureSomeFile(files);
  const snap = await loadSnapshot();
  const { report } = analyze(files, snap);
  report.dryRun = true;
  return report;
}

// ─── Etapa 2: commit (grava em lote; sem e-mail/notificação) ──────────────────

export async function commitImport(actor: SessionUser, files: ImportFiles): Promise<ImportReport> {
  requireAdmin(actor);
  ensureSomeFile(files);
  const snap = await loadSnapshot();
  const { plan, report } = analyze(files, snap);
  report.dryRun = false;

  const now = new Date();
  const CHUNK = 200;

  // 1) Obras primeiro (FK dos projetos).
  await createManyInChunks(plan.works.map((w) => ({ id: w.id, constructorId: w.constructorId, name: w.name })), CHUNK, (data) =>
    prisma.work.createMany({ data, skipDuplicates: true }),
  );

  // 2) Projetos.
  await createManyInChunks(
    plan.projects.map((p) => ({
      id: p.id,
      code: p.code,
      constructorId: p.constructorId,
      workId: p.workId,
      sellerId: p.sellerId,
      equipmentId: p.equipmentId,
      cabinTypeId: p.cabinTypeId,
      engineerId: p.engineerId,
      engineerName: p.engineerName,
      engineerPhone: p.engineerPhone,
      status: p.status,
      priority: p.priority,
      projectReceived: p.projectReceived,
      cabinLocationDefined: p.cabinLocationDefined,
      alignmentCompleted: p.alignmentCompleted,
      alignmentDate: p.alignmentDate,
      currentStatusEnteredAt: p.createdAt,
      createdAt: p.createdAt,
      createdById: actor.id,
    })),
    CHUNK,
    (data) => prisma.project.createMany({ data, skipDuplicates: true }),
  );

  // 3) Histórico de status inicial.
  await createManyInChunks(
    plan.projects.map((p) => ({
      id: randomUUID(),
      projectId: p.id,
      fromStatus: null,
      toStatus: p.status,
      enteredAt: p.createdAt,
      source: "importacao-legado",
      changedById: actor.id,
    })),
    CHUNK,
    (data) => prisma.projectStatusHistory.createMany({ data, skipDuplicates: true }),
  );

  // 4) Observações (apenas as não-vazias).
  const obs = plan.projects
    .filter((p) => p.observation)
    .map((p) => ({ id: randomUUID(), projectId: p.id, author: `Importação (${actor.name})`, text: p.observation as string, createdAt: now }));
  await createManyInChunks(obs, CHUNK, (data) => prisma.projectObservation.createMany({ data, skipDuplicates: true }));

  report.committed = { works: plan.works.length, projects: plan.projects.length };

  await writeAudit({
    action: "PROJECTS_IMPORTED",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: "import",
    message: `${actor.name} importou ${plan.projects.length} projeto(s) e ${plan.works.length} obra(s) do legado (CSV).`,
    metadata: {
      works: plan.works.length,
      projects: plan.projects.length,
      tempCodes: report.tempCodesAssigned,
      duplicatesSkipped: report.projectsSkippedDuplicate.length,
      constructorsNotFound: report.constructorsNotFound.length,
      rowsRead: report.rowsRead,
    },
  });

  return report;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function requireAdmin(actor: SessionUser) {
  assertPermission(actor, (p) => p.projects.create);
  if (actor.role !== "ADMIN") {
    throw new HttpError(403, "Apenas administradores podem importar projetos do legado.");
  }
}

function ensureSomeFile(files: ImportFiles) {
  if (!files.cadastroCsv?.trim() && !files.anteCsv?.trim()) {
    throw new HttpError(400, "Envie ao menos um CSV (Cadastro Inicial ou Ante-Projeto).");
  }
}

async function createManyInChunks<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    if (chunk.length) await fn(chunk);
  }
}
