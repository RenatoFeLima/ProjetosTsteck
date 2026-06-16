// Importação do Ante-Projeto CSV — fonte oficial para os status operacionais de ante-projeto.
// Fluxo:
//   1. dry-run: simula sem gravar; mostra projetos que seriam deletados + criados.
//   2. commit: dentro de transação, deleta projetos dos 3 status de ante-projeto e
//              recria a partir do CSV. Não dispara e-mail/notificação.
//
// Regras de segurança:
//   - Apenas ADMIN pode executar.
//   - Apenas projetos em ELABORAR_ANTE_PROJETO | ANTE_PROJETO_ENVIADO | ANTE_PROJETO_APROVADO
//     são deletados. Outros status (CADASTRO_INICIAL, PROJETO_FINAL_ENVIADO, etc.) intocados.
//   - Rollback total em qualquer erro no commit.
//   - Sem e-mail, sem notificação, sem alteração de projetos fora dos 3 status.

import { randomUUID } from "node:crypto";
import { differenceInCalendarDays, parseISO, formatISO } from "date-fns";
import { prisma } from "@/lib/db/prisma";
import { assertPermission, HttpError } from "@/server/auth/guards";
import type { SessionUser } from "@/server/auth/session";
import { writeAudit } from "./auditService";
import { parseCsvToObjectsWithDiag } from "@/features/import/domain/csv";
import {
  normalizeName,
  normalizeCode,
  cleanEngineerName,
  parseDateBr,
} from "@/features/import/domain/import-normalize";
import { canonicalConstructorName } from "@/features/import/domain/import-aliases";
import { DB_TO_UI_STATUS, type DbStatus } from "@/features/projects/domain/project-status-map";
import type { AnteProjetoReport, AnteProjetoRefNotFound } from "@/features/import/domain/ante-projeto-import-types";

// ─── Status que serão limpos antes da importação ──────────────────────────────

const ANTE_STATUSES_TO_CLEAN = ["ELABORAR_ANTE_PROJETO", "ANTE_PROJETO_ENVIADO", "ANTE_PROJETO_APROVADO"] as const;
type AnteDbStatus = (typeof ANTE_STATUSES_TO_CLEAN)[number];

// ─── Mapeamento de status do novo CSV ────────────────────────────────────────

const CSV_STATUS_MAP: Record<string, AnteDbStatus> = {
  "elaborar ante-projeto": "ELABORAR_ANTE_PROJETO",
  "ante-projeto enviado": "ANTE_PROJETO_ENVIADO",
  "ante-projeto aprovado": "ANTE_PROJETO_APROVADO",
};

function mapCsvStatus(raw: string): { ok: true; status: AnteDbStatus; urgente: boolean } | { ok: false; raw: string } {
  const key = raw.trim().toLowerCase();
  if (key === "urgente!" || key === "urgente") {
    return { ok: true, status: "ELABORAR_ANTE_PROJETO", urgente: true };
  }
  const mapped = CSV_STATUS_MAP[key];
  if (mapped) return { ok: true, status: mapped, urgente: false };
  return { ok: false, raw };
}

// ─── Snapshot ────────────────────────────────────────────────────────────────

type Snapshot = {
  constructors: Map<string, { id: string; name: string }>;
  works: Map<string, string>; // `${constructorId}::${normName}` -> workId
  sellers: Map<string, string>; // normName -> id
  equipment: Map<string, string>; // normalizeCode -> id
  cabinTypes: Map<string, string>; // normName -> id
  projectsToDelete: { id: string; code: string; status: string; constructorName: string; workName: string }[];
  codesInOtherStatuses: Set<string>; // UPPER — não podem ser duplicados
  maxTempSuffix: number;
};

async function loadSnapshot(): Promise<Snapshot> {
  const [constructors, works, sellers, equipment, cabinTypes, anteProjects, otherProjects] = await Promise.all([
    prisma.constructor.findMany({ where: { active: true } }),
    prisma.work.findMany({ where: { active: true }, select: { id: true, name: true, constructorId: true } }),
    prisma.seller.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.equipment.findMany({ where: { active: true }, select: { id: true, code: true } }),
    prisma.cabinType.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.project.findMany({
      where: { status: { in: [...ANTE_STATUSES_TO_CLEAN] } },
      select: {
        id: true,
        code: true,
        status: true,
      },
    }),
    prisma.project.findMany({
      where: { status: { notIn: [...ANTE_STATUSES_TO_CLEAN] } },
      select: { code: true },
    }),
  ]);

  const snap: Snapshot = {
    constructors: new Map(),
    works: new Map(),
    sellers: new Map(),
    equipment: new Map(),
    cabinTypes: new Map(),
    projectsToDelete: [],
    codesInOtherStatuses: new Set(),
    maxTempSuffix: 0,
  };

  constructors.forEach((c) => snap.constructors.set(normalizeName(c.name), { id: c.id, name: c.name }));
  works.forEach((w) => snap.works.set(`${w.constructorId}::${normalizeName(w.name)}`, w.id));
  sellers.forEach((s) => snap.sellers.set(normalizeName(s.name), s.id));
  equipment.forEach((e) => snap.equipment.set(normalizeCode(e.code), e.id));
  cabinTypes.forEach((c) => snap.cabinTypes.set(normalizeName(c.name), c.id));

  anteProjects.forEach((p) => {
    snap.projectsToDelete.push({
      id: p.id,
      code: p.code,
      status: p.status,
      constructorName: "",
      workName: "",
    });
    // Codes being deleted are NOT added to codesInOtherStatuses — they're available for reuse.
    const m = p.code.trim().toUpperCase().match(/^CRE-TMP-(\d+)$/);
    if (m) snap.maxTempSuffix = Math.max(snap.maxTempSuffix, Number(m[1]));
  });

  otherProjects.forEach((p) => {
    snap.codesInOtherStatuses.add(p.code.trim().toUpperCase());
    const m = p.code.trim().toUpperCase().match(/^CRE-TMP-(\d+)$/);
    if (m) snap.maxTempSuffix = Math.max(snap.maxTempSuffix, Number(m[1]));
  });

  return snap;
}

// ─── Matching auxiliares ──────────────────────────────────────────────────────

function fuzzySeller(raw: string, snap: Snapshot): string | null {
  const norm = normalizeName(raw);
  const exact = snap.sellers.get(norm);
  if (exact) return exact;
  for (const [key, id] of snap.sellers) {
    if (norm.startsWith(key) || key.startsWith(norm)) return id;
  }
  return null;
}

function fuzzyEquipment(raw: string, snap: Snapshot): string | null {
  if (!raw || normalizeName(raw) === "nao encontrado") return null;
  return snap.equipment.get(normalizeCode(raw)) ?? null;
}

function fuzzyCabinType(raw: string, snap: Snapshot): string | null {
  if (!raw || normalizeName(raw) === "nao encontrado") return null;
  return snap.cabinTypes.get(normalizeName(raw)) ?? null;
}

// ─── Análise (puro — sem gravar) ─────────────────────────────────────────────

type PlannedConstructor = { id: string; name: string };
type PlannedWork = { id: string; constructorId: string; name: string };
type PlannedProject = {
  id: string;
  code: string;
  tempCode: boolean;
  constructorId: string;
  workId: string | null;
  sellerId: string | null;
  equipmentId: string | null;
  cabinTypeId: string | null;
  engineerName: string | null;
  status: AnteDbStatus;
  priority: "NORMAL" | "URGENTE";
  deadline: Date | null;
  observation: string | null;
};

type Plan = { constructors: PlannedConstructor[]; works: PlannedWork[]; projects: PlannedProject[] };

function todayIso(): string {
  return formatISO(new Date(), { representation: "date" });
}

function analyze(csvText: string, snap: Snapshot): { plan: Plan; report: AnteProjetoReport } {
  const today = todayIso();

  const { rows, diag } = parseCsvToObjectsWithDiag(csvText, "STATUS");

  if (!diag.delimiter) {
    throw new HttpError(400, "Não foi possível identificar o separador do CSV. Use vírgula (,), ponto-e-vírgula (;) ou tab.");
  }

  const report: AnteProjetoReport = {
    dryRun: true,
    diagnostic: diag,
    rowsRead: 0,
    rowsValid: 0,
    rowsInvalid: 0,
    projectsToDelete: snap.projectsToDelete.map((p) => ({
      id: p.id,
      code: p.code,
      construtora: p.constructorName,
      obra: p.workName,
      status: p.status,
      statusLabel: DB_TO_UI_STATUS[p.status as DbStatus] ?? p.status,
    })),
    constructorsToCreate: [],
    constructorsReused: 0,
    worksToCreate: [],
    worksReused: 0,
    worksDuplicateInFile: 0,
    projectsToCreate: [],
    projectsSkipped: [],
    projectsUrgente: 0,
    projectsWithDeadline: 0,
    projectsWithoutDeadline: 0,
    projectsOverdue: 0,
    projectsDueToday: 0,
    projectsFuture: 0,
    dateErrors: [],
    sellersNotFound: [],
    equipmentNotFound: [],
    cabinTypesNotFound: [],
    byStatus: { ELABORAR_ANTE_PROJETO: 0, ANTE_PROJETO_ENVIADO: 0, ANTE_PROJETO_APROVADO: 0 },
  };

  const plan: Plan = { constructors: [], works: [], projects: [] };

  // Clones mutáveis para deduplicação no run.
  const knownConstructors = new Map(snap.constructors);
  const knownWorks = new Map(snap.works);
  const plannedConstructorByNorm = new Map<string, string>();
  const plannedWorkIdByKey = new Map<string, string>();
  const reportedConstructorNorms = new Set<string>();
  const usedCodes = new Set(snap.codesInOtherStatuses);
  // Codes being deleted are available for reuse — do NOT pre-populate usedCodes from them.

  let tempSuffix = snap.maxTempSuffix;
  const nextTempCode = (): string => {
    let code: string;
    do {
      tempSuffix += 1;
      code = `CRE-TMP-${String(tempSuffix).padStart(4, "0")}`;
    } while (usedCodes.has(code));
    usedCodes.add(code);
    return code;
  };

  const resolveConstructor = (raw: string): { id: string; name: string } => {
    const name = canonicalConstructorName(raw.trim());
    const norm = normalizeName(name);
    const existing = knownConstructors.get(norm);
    if (existing) {
      report.constructorsReused += 1;
      return existing;
    }
    const plannedId = plannedConstructorByNorm.get(norm);
    if (plannedId) return { id: plannedId, name };
    const id = randomUUID();
    plannedConstructorByNorm.set(norm, id);
    plan.constructors.push({ id, name });
    knownConstructors.set(norm, { id, name });
    if (!reportedConstructorNorms.has(norm)) {
      reportedConstructorNorms.add(norm);
      report.constructorsToCreate.push({ name });
    }
    return { id, name };
  };

  const resolveWork = (constructor: { id: string; name: string }, obraRaw: string): string | null => {
    const obra = obraRaw.trim();
    if (!obra) return null;
    const key = `${constructor.id}::${normalizeName(obra)}`;
    const existing = knownWorks.get(key);
    if (existing) {
      report.worksReused += 1;
      return existing;
    }
    const planned = plannedWorkIdByKey.get(key);
    if (planned) {
      report.worksDuplicateInFile += 1;
      return planned;
    }
    const id = randomUUID();
    plannedWorkIdByKey.set(key, id);
    knownWorks.set(key, id);
    plan.works.push({ id, constructorId: constructor.id, name: obra });
    report.worksToCreate.push({ construtora: constructor.name, obra });
    return id;
  };

  const addRef = (arr: AnteProjetoRefNotFound[], construtora: string, obra: string, valor: string, field: AnteProjetoRefNotFound["field"]) => {
    // Deduplicate by construtora+obra+valor.
    if (!arr.some((r) => r.construtora === construtora && r.obra === obra && r.valor === valor)) {
      arr.push({ construtora, obra, valor, field });
    }
  };

  report.rowsRead = rows.length;

  for (const r of rows) {
    const construtoraRaw = (r["CONSTRUTORA"] ?? "").trim();
    if (!construtoraRaw) {
      report.rowsInvalid += 1;
      continue;
    }

    const obraRaw = (r["OBRA"] ?? "").trim();
    if (!obraRaw) {
      report.rowsInvalid += 1;
      report.projectsSkipped.push({ code: r["PROJETO"] ?? "", construtora: construtoraRaw, obra: "", reason: "OBRA em branco" });
      continue;
    }

    const rawStatus = (r["STATUS"] ?? "").trim();
    if (!rawStatus) {
      report.rowsInvalid += 1;
      report.projectsSkipped.push({ code: r["PROJETO"] ?? "", construtora: construtoraRaw, obra: obraRaw, reason: "STATUS em branco" });
      continue;
    }

    const statusResult = mapCsvStatus(rawStatus);
    if (!statusResult.ok) {
      report.rowsInvalid += 1;
      report.projectsSkipped.push({ code: r["PROJETO"] ?? "", construtora: construtoraRaw, obra: obraRaw, reason: `STATUS desconhecido: "${statusResult.raw}"` });
      continue;
    }

    // Código do projeto
    const rawCode = (r["PROJETO"] ?? "").trim();
    let code: string;
    let tempCode = false;
    if (rawCode) {
      const up = rawCode.toUpperCase();
      if (snap.codesInOtherStatuses.has(up)) {
        report.rowsInvalid += 1;
        report.projectsSkipped.push({ code: rawCode, construtora: construtoraRaw, obra: obraRaw, reason: `código "${rawCode}" existe em outro status — revisão manual necessária` });
        continue;
      }
      if (usedCodes.has(up)) {
        // Duplicate code within this CSV
        report.rowsInvalid += 1;
        report.projectsSkipped.push({ code: rawCode, construtora: construtoraRaw, obra: obraRaw, reason: `código "${rawCode}" duplicado no arquivo CSV` });
        continue;
      }
      usedCodes.add(up);
      code = rawCode;
    } else {
      code = nextTempCode();
      tempCode = true;
    }

    // DATA PRAZO
    let deadline: Date | null = null;
    const dpRaw = (r["DATA PRAZO"] ?? "").trim();
    if (dpRaw) {
      const dp = parseDateBr(dpRaw);
      if (!dp.ok) {
        report.dateErrors.push({ field: "DATA PRAZO", raw: dpRaw, construtora: construtoraRaw, obra: obraRaw });
      } else if (dp.date) {
        deadline = dp.date;
      }
    }

    // Construtora e Obra
    const constructor = resolveConstructor(construtoraRaw);
    const workId = resolveWork(constructor, obraRaw);

    // Referências match-only
    const vendedorRaw = (r["VENDEDOR"] ?? "").trim();
    const equipRaw = (r["EQUIPAMENTO"] ?? "").trim();
    const cabineRaw = (r["TIPO DA CABINE"] ?? "").trim();
    const sellerId = vendedorRaw ? fuzzySeller(vendedorRaw, snap) : null;
    if (vendedorRaw && !sellerId) addRef(report.sellersNotFound, construtoraRaw, obraRaw, vendedorRaw, "vendedor");
    const equipmentId = equipRaw ? fuzzyEquipment(equipRaw, snap) : null;
    if (equipRaw && normalizeName(equipRaw) !== "nao encontrado" && !equipmentId) {
      addRef(report.equipmentNotFound, construtoraRaw, obraRaw, equipRaw, "equipamento");
    }
    const cabinTypeId = cabineRaw ? fuzzyCabinType(cabineRaw, snap) : null;
    if (cabineRaw && normalizeName(cabineRaw) !== "nao encontrado" && !cabinTypeId) {
      addRef(report.cabinTypesNotFound, construtoraRaw, obraRaw, cabineRaw, "tipo_cabine");
    }

    const engName = cleanEngineerName(r["ENGENHEIRO"] ?? "");
    const observation = (r["OBSERVAÇÃO"] ?? "").trim() || null;

    plan.projects.push({
      id: randomUUID(),
      code,
      tempCode,
      constructorId: constructor.id,
      workId,
      sellerId,
      equipmentId,
      cabinTypeId,
      engineerName: engName || null,
      status: statusResult.status,
      priority: statusResult.urgente ? "URGENTE" : "NORMAL",
      deadline,
      observation,
    });

    report.rowsValid += 1;
    if (statusResult.urgente) report.projectsUrgente += 1;
    report.byStatus[statusResult.status] += 1;

    if (deadline) {
      report.projectsWithDeadline += 1;
      const dueDateStr = formatISO(deadline, { representation: "date" });
      const diff = differenceInCalendarDays(parseISO(dueDateStr), parseISO(today));
      if (diff < 0) report.projectsOverdue += 1;
      else if (diff === 0) report.projectsDueToday += 1;
      else report.projectsFuture += 1;
    } else {
      report.projectsWithoutDeadline += 1;
    }

    report.projectsToCreate.push({
      code,
      tempCode,
      construtora: constructor.name,
      obra: obraRaw,
      status: statusResult.status,
      statusLabel: DB_TO_UI_STATUS[statusResult.status as DbStatus] ?? statusResult.status,
      urgente: statusResult.urgente,
      deadline: deadline ? formatISO(deadline, { representation: "date" }) : null,
    });
  }

  return { plan, report };
}

// ─── Validação antes do commit ────────────────────────────────────────────────

function validateBeforeCommit(report: AnteProjetoReport): void {
  if (report.rowsInvalid > 0 && report.rowsValid === 0) {
    throw new HttpError(400, "Nenhuma linha válida no CSV. Corrija os erros antes de confirmar.");
  }
  if (report.projectsSkipped.some((s) => s.reason.includes("STATUS desconhecido"))) {
    throw new HttpError(400, "Há linhas com STATUS desconhecido no CSV. Corrija antes de confirmar.");
  }
}

// ─── Dry-run ──────────────────────────────────────────────────────────────────

export async function dryRunAnteProjetoImport(actor: SessionUser, csvText: string): Promise<AnteProjetoReport> {
  requireAdmin(actor);
  ensureContent(csvText);
  const snap = await loadSnapshot();
  const { report } = analyze(csvText, snap);
  report.dryRun = true;
  return report;
}

// ─── Commit ───────────────────────────────────────────────────────────────────

export async function commitAnteProjetoImport(actor: SessionUser, csvText: string): Promise<AnteProjetoReport> {
  requireAdmin(actor);
  ensureContent(csvText);
  const snap = await loadSnapshot();
  const { plan, report } = analyze(csvText, snap);
  report.dryRun = false;

  validateBeforeCommit(report);

  const now = new Date();
  const CHUNK = 200;

  // Tudo dentro de uma transação: delete dos projetos antigos + create dos novos.
  await prisma.$transaction(
    async (tx) => {
      // 1. Deletar projetos dos 3 status de ante-projeto (cascades: history, observations, notifications).
      if (snap.projectsToDelete.length > 0) {
        const ids = snap.projectsToDelete.map((p) => p.id);
        for (let i = 0; i < ids.length; i += CHUNK) {
          await tx.project.deleteMany({ where: { id: { in: ids.slice(i, i + CHUNK) } } });
        }
      }

      // 2. Construtoras novas.
      for (let i = 0; i < plan.constructors.length; i += CHUNK) {
        await tx.constructor.createMany({
          data: plan.constructors.slice(i, i + CHUNK).map((c) => ({ id: c.id, name: c.name })),
          skipDuplicates: true,
        });
      }

      // 3. Obras novas.
      for (let i = 0; i < plan.works.length; i += CHUNK) {
        await tx.work.createMany({
          data: plan.works.slice(i, i + CHUNK).map((w) => ({ id: w.id, constructorId: w.constructorId, name: w.name })),
          skipDuplicates: true,
        });
      }

      // 4. Projetos.
      for (let i = 0; i < plan.projects.length; i += CHUNK) {
        await tx.project.createMany({
          data: plan.projects.slice(i, i + CHUNK).map((p) => ({
            id: p.id,
            code: p.code,
            constructorId: p.constructorId,
            workId: p.workId,
            sellerId: p.sellerId,
            equipmentId: p.equipmentId,
            cabinTypeId: p.cabinTypeId,
            engineerName: p.engineerName,
            status: p.status,
            priority: p.priority,
            deadline: p.deadline,
            currentStatusEnteredAt: now,
            createdAt: now,
            createdById: actor.id,
          })),
          skipDuplicates: true,
        });
      }

      // 5. Histórico de status inicial.
      for (let i = 0; i < plan.projects.length; i += CHUNK) {
        await tx.projectStatusHistory.createMany({
          data: plan.projects.slice(i, i + CHUNK).map((p) => ({
            id: randomUUID(),
            projectId: p.id,
            fromStatus: null,
            toStatus: p.status,
            enteredAt: now,
            source: "importacao-ante-projeto",
            changedById: actor.id,
            note: "Importação CSV Ante-Projeto",
          })),
          skipDuplicates: true,
        });
      }

      // 6. Observações.
      const obs = plan.projects.filter((p) => p.observation).map((p) => ({
        id: randomUUID(),
        projectId: p.id,
        author: `Importação CSV Ante-Projeto (${actor.name})`,
        text: p.observation as string,
        createdAt: now,
      }));
      for (let i = 0; i < obs.length; i += CHUNK) {
        await tx.projectObservation.createMany({ data: obs.slice(i, i + CHUNK), skipDuplicates: true });
      }
    },
    { timeout: 60_000 },
  );

  report.committed = {
    deleted: snap.projectsToDelete.length,
    constructors: plan.constructors.length,
    works: plan.works.length,
    projects: plan.projects.length,
  };

  await writeAudit({
    action: "ANTE_PROJETO_IMPORTED",
    actorUserId: actor.id,
    actorName: actor.name,
    entityType: "import",
    message:
      `${actor.name} importou o CSV de Ante-Projeto: ` +
      `${snap.projectsToDelete.length} projeto(s) removido(s), ` +
      `${plan.projects.length} projeto(s) criado(s), ` +
      `${plan.works.length} obra(s) criada(s), ` +
      `${plan.constructors.length} construtora(s) criada(s).`,
    metadata: {
      deleted: snap.projectsToDelete.length,
      created: plan.projects.length,
      works: plan.works.length,
      constructors: plan.constructors.length,
      urgente: report.projectsUrgente,
      semPrazo: report.projectsWithoutDeadline,
      atrasados: report.projectsOverdue,
      rowsRead: report.rowsRead,
      rowsValid: report.rowsValid,
      rowsInvalid: report.rowsInvalid,
      duplicatesSkipped: report.projectsSkipped.length,
      sellersNotFound: report.sellersNotFound.length,
      equipmentNotFound: report.equipmentNotFound.length,
      cabinTypesNotFound: report.cabinTypesNotFound.length,
    },
  });

  return report;
}

// ─── Guards ───────────────────────────────────────────────────────────────────

function requireAdmin(actor: SessionUser) {
  assertPermission(actor, (p) => p.projects.create);
  if (actor.role !== "ADMIN") {
    throw new HttpError(403, "Apenas administradores podem importar projetos.");
  }
}

function ensureContent(csvText: string) {
  if (!csvText?.trim()) {
    throw new HttpError(400, "CSV vazio ou não enviado.");
  }
}
