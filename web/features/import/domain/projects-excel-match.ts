// Núcleo PURO da reimportação Excel/CSV de projetos (sem Prisma).
// Atualiza SOMENTE projetos existentes, casando por ID do Projeto (fallback:
// código único → construtora+obra único). Campo vazio NÃO apaga valor existente.
// Status é read-only (só aviso). Não cria mestres, não cria/deleta projeto.

import {
  normalizeName,
  normalizeCode,
  cleanEngineerName,
  parseBoolPt,
  parseDateBr,
  onlyDigits,
} from "./import-normalize";
import { DB_TO_UI_STATUS, UI_TO_DB_STATUS, type DbStatus } from "@/features/projects/domain/project-status-map";
import { ID_HEADER } from "@/features/projects/domain/project-export";
import type {
  ProjectsExcelImportReport,
  ExcelMatchedProject,
  ExcelFieldChange,
} from "./projects-excel-import-types";

// ─── Snapshot (preenchido pelo service) ────────────────────────────────────────

export type ExcelSnapshotProject = {
  id: string;
  code: string;
  status: string; // DB enum
  constructorName: string | null;
  workName: string | null;
  sellerName: string | null;
  equipmentCode: string | null;
  cabinTypeName: string | null;
  engineerName: string | null;
  engineerPhone: string | null;
  /** ISO yyyy-MM-dd (data de lançamento = createdAt). */
  dataLancamento: string | null;
  projetoObraRecebido: boolean;
  localCabineDefinido: boolean;
  alinhamentoConcluido: boolean;
  dataAlinhamento: string | null; // yyyy-MM-dd
  urgente: boolean;
  prazoUrgencia: string | null; // yyyy-MM-dd
  motivoUrgencia: string | null;
  observationTexts: string[]; // normalizados
};

export type NamedRef = { id: string; displayName: string };

export type ExcelMatchSnapshot = {
  byId: Map<string, ExcelSnapshotProject>;
  byCode: Map<string, ExcelSnapshotProject[]>; // codeUpper -> projetos
  byWork: Map<string, ExcelSnapshotProject[]>; // norm(constr)::norm(obra) -> projetos
  codeOwner: Map<string, string>; // codeUpper -> projectId (todos)
  sellers: Map<string, NamedRef>;
  equipment: Map<string, NamedRef>;
  cabinTypes: Map<string, NamedRef>;
};

// ─── Plano ──────────────────────────────────────────────────────────────────────

export type ExcelPlannedUpdate = {
  projectId: string;
  data: {
    code?: string;
    sellerId?: string;
    equipmentId?: string;
    cabinTypeId?: string;
    engineerName?: string;
    engineerPhone?: string;
    projectReceived?: boolean;
    cabinLocationDefined?: boolean;
    alignmentCompleted?: boolean;
    alignmentDate?: Date | null;
    priority?: "URGENTE" | "NORMAL";
    urgentDeadline?: Date | null;
    urgentReason?: string | null;
  };
  observationToAdd: string | null;
};

export type ExcelMatchPlan = { updates: ExcelPlannedUpdate[] };

// ─── Helpers ─────────────────────────────────────────────────────────────────────

function stripDots(s: string): string {
  return s.replace(/\./g, "").replace(/\s+/g, " ").trim();
}
function normalizeCabin(raw: string): string {
  return normalizeName(raw).replace(/\.\s*$/, "").replace(/c\.o\./g, "c.o").replace(/\s*\+\s*/g, " + ").trim();
}
export function excelWorkKey(constr: string, obra: string): string {
  return `${normalizeName(constr)}::${normalizeName(obra)}`;
}

function matchSeller(raw: string, snap: ExcelMatchSnapshot): NamedRef | null {
  if (!raw) return null;
  const norm = stripDots(normalizeName(raw));
  const exact = snap.sellers.get(norm);
  if (exact) return exact;
  for (const [key, entry] of snap.sellers) {
    if (key.startsWith(norm) || norm.startsWith(key)) return entry;
  }
  return null;
}
function matchEquipment(raw: string, snap: ExcelMatchSnapshot): NamedRef | null {
  if (!raw || normalizeName(raw) === "nao encontrado") return null;
  return snap.equipment.get(normalizeCode(raw)) ?? null;
}
function matchCabinType(raw: string, snap: ExcelMatchSnapshot): NamedRef | null {
  if (!raw || normalizeName(raw) === "nao encontrado") return null;
  return snap.cabinTypes.get(normalizeCabin(raw)) ?? null;
}

/** dd/mm/aaaa → yyyy-MM-dd (sem timezone shift) | "INVALID" | null (vazio). */
function parseDateCell(raw: string): { ok: true; iso: string | null } | { ok: false } {
  const v = (raw ?? "").trim();
  if (!v) return { ok: true, iso: null };
  const p = parseDateBr(v);
  if (!p.ok || !p.date) return { ok: false };
  return { ok: true, iso: p.date.toISOString().slice(0, 10) };
}

function isoToDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

// ─── Resolução de chave ────────────────────────────────────────────────────────

type Resolution =
  | { ok: true; project: ExcelSnapshotProject; matchedBy: ExcelMatchedProject["matchedBy"] }
  | { ok: false; reason: "nao-encontrado" | "conflito-multiplos"; detail: string };

function resolveProject(
  row: Record<string, string>,
  snap: ExcelMatchSnapshot,
): Resolution {
  const id = (row[ID_HEADER] ?? "").trim();
  if (id) {
    const p = snap.byId.get(id);
    if (p) return { ok: true, project: p, matchedBy: "id" };
    return { ok: false, reason: "nao-encontrado", detail: `ID "${id}" não existe no sistema.` };
  }
  // Fallback 1: código único.
  const code = (row["Código"] ?? "").trim();
  if (code) {
    const list = snap.byCode.get(code.toUpperCase()) ?? [];
    if (list.length === 1) return { ok: true, project: list[0], matchedBy: "codigo" };
    if (list.length > 1) return { ok: false, reason: "conflito-multiplos", detail: `Código "${code}" pertence a ${list.length} projetos.` };
  }
  // Fallback 2: construtora + obra único.
  const constr = (row["Construtora"] ?? "").trim();
  const obra = (row["Obra"] ?? "").trim();
  if (constr && obra) {
    const list = snap.byWork.get(excelWorkKey(constr, obra)) ?? [];
    if (list.length === 1) return { ok: true, project: list[0], matchedBy: "construtora_obra" };
    if (list.length > 1) return { ok: false, reason: "conflito-multiplos", detail: `Construtora + obra casam com ${list.length} projetos.` };
  }
  return { ok: false, reason: "nao-encontrado", detail: "Sem ID, código ou construtora+obra que identifiquem um projeto." };
}

// ─── Núcleo: analyze ──────────────────────────────────────────────────────────

export function analyzeProjectsExcel(
  rows: Record<string, string>[],
  snap: ExcelMatchSnapshot,
  report: ProjectsExcelImportReport,
): { plan: ExcelMatchPlan; report: ProjectsExcelImportReport } {
  const plan: ExcelMatchPlan = { updates: [] };
  const touched = new Set<string>();
  const codesClaimed = new Map<string, number>();
  const sellersNF = new Set<string>();
  const equipNF = new Set<string>();
  const cabinNF = new Set<string>();

  rows.forEach((r, idx) => {
    const csvRow = idx + 1;
    const codeCell = (r["Código"] ?? "").trim();
    const constrCell = (r["Construtora"] ?? "").trim();
    const obraCell = (r["Obra"] ?? "").trim();

    const res = resolveProject(r, snap);
    if (!res.ok) {
      const bucket = res.reason === "conflito-multiplos" ? report.conflicts : report.notFound;
      bucket.push({ csvRow, codigo: codeCell, construtora: constrCell, obra: obraCell, reason: res.reason, detail: res.detail });
      return;
    }
    const project = res.project;

    if (touched.has(project.id)) {
      report.conflicts.push({ csvRow, codigo: codeCell, construtora: constrCell, obra: obraCell, reason: "conflito-multiplos", detail: "Mais de uma linha aponta para o mesmo projeto." });
      return;
    }

    const data: ExcelPlannedUpdate["data"] = {};
    const changes: ExcelFieldChange[] = [];
    const pendingRefs: ExcelMatchedProject["pendingRefs"] = [];

    // ── Código (vazio não apaga) ──
    if (codeCell && codeCell !== project.code) {
      const up = codeCell.toUpperCase();
      const owner = snap.codeOwner.get(up);
      const claimed = codesClaimed.get(up);
      if ((owner !== undefined && owner !== project.id) || (claimed !== undefined && claimed !== csvRow)) {
        report.duplicateCodes.push({ csvRow, codigo: codeCell, construtora: constrCell, obra: obraCell, reason: "codigo-duplicado", detail: `Código "${codeCell}" já pertence a outro projeto.` });
        return; // linha bloqueada — revisão manual
      }
      data.code = codeCell;
      codesClaimed.set(up, csvRow);
      changes.push({ field: "codigo", label: "Código", from: project.code, to: codeCell });
    }

    // ── Vendedor ──
    const vendedor = (r["Vendedor"] ?? "").trim();
    if (vendedor) {
      const ref = matchSeller(vendedor, snap);
      if (ref) {
        if (normalizeName(ref.displayName) !== normalizeName(project.sellerName ?? "")) {
          data.sellerId = ref.id;
          changes.push({ field: "vendedor", label: "Vendedor", from: project.sellerName, to: ref.displayName });
        }
      } else { sellersNF.add(vendedor); pendingRefs.push({ field: "vendedor", valor: vendedor }); }
    }

    // ── Equipamento ──
    const equip = (r["Equipamento"] ?? "").trim();
    if (equip && normalizeName(equip) !== "nao encontrado") {
      const ref = matchEquipment(equip, snap);
      if (ref) {
        if (normalizeCode(ref.displayName) !== normalizeCode(project.equipmentCode ?? "")) {
          data.equipmentId = ref.id;
          changes.push({ field: "equipamento", label: "Equipamento", from: project.equipmentCode, to: ref.displayName });
        }
      } else { equipNF.add(equip); pendingRefs.push({ field: "equipamento", valor: equip }); }
    }

    // ── Tipo de cabine ──
    const cabine = (r["Tipo de Cabine"] ?? "").trim();
    if (cabine && normalizeName(cabine) !== "nao encontrado") {
      const ref = matchCabinType(cabine, snap);
      if (ref) {
        if (normalizeName(ref.displayName) !== normalizeName(project.cabinTypeName ?? "")) {
          data.cabinTypeId = ref.id;
          changes.push({ field: "tipo_cabine", label: "Tipo de cabine", from: project.cabinTypeName, to: ref.displayName });
        }
      } else { cabinNF.add(cabine); pendingRefs.push({ field: "tipo_cabine", valor: cabine }); }
    }

    // ── Engenheiro (inline) ──
    const eng = cleanEngineerName(r["Engenheiro"] ?? "");
    if (eng && normalizeName(eng) !== normalizeName(project.engineerName ?? "")) {
      data.engineerName = eng;
      changes.push({ field: "engenheiro", label: "Engenheiro", from: project.engineerName, to: eng });
    }

    // ── Telefone (inline) ──
    const phone = onlyDigits(r["Telefone"] ?? "");
    if (phone && phone !== onlyDigits(project.engineerPhone ?? "")) {
      data.engineerPhone = phone;
      changes.push({ field: "telefone", label: "Telefone", from: project.engineerPhone, to: phone });
    }

    // ── Datas e booleanos ──
    let dateError: string | null = null;

    // Data de Lançamento mapeia para createdAt (data de criação) — protegida.
    // Validamos o formato (para alertar erro), mas NÃO atualizamos createdAt.
    const dl = parseDateCell(r["Data de Lançamento"] ?? "");
    if (!dl.ok) dateError = "Data de Lançamento inválida.";

    const da = parseDateCell(r["Data do Alinhamento"] ?? "");
    if (!da.ok) dateError = "Data do Alinhamento inválida.";
    else if (da.iso && da.iso !== project.dataAlinhamento) {
      data.alignmentDate = isoToDate(da.iso);
      changes.push({ field: "data_alinhamento", label: "Data do Alinhamento", from: project.dataAlinhamento, to: da.iso });
    }

    const bool = (header: string): boolean | undefined => {
      const raw = (r[header] ?? "").trim();
      if (!raw) return undefined; // vazio não apaga
      return parseBoolPt(raw);
    };
    const por = bool("Projeto de Obra Recebido");
    if (por !== undefined && por !== project.projetoObraRecebido) {
      data.projectReceived = por;
      changes.push({ field: "proj_obra_recebido", label: "Projeto de Obra Recebido", from: project.projetoObraRecebido ? "Sim" : "Não", to: por ? "Sim" : "Não" });
    }
    const lcd = bool("Local da Cabine Definido");
    if (lcd !== undefined && lcd !== project.localCabineDefinido) {
      data.cabinLocationDefined = lcd;
      changes.push({ field: "local_cabine_definido", label: "Local da Cabine Definido", from: project.localCabineDefinido ? "Sim" : "Não", to: lcd ? "Sim" : "Não" });
    }
    const alc = bool("Alinhamento Concluído");
    if (alc !== undefined && alc !== project.alinhamentoConcluido) {
      data.alignmentCompleted = alc;
      changes.push({ field: "alinhamento", label: "Alinhamento Concluído", from: project.alinhamentoConcluido ? "Sim" : "Não", to: alc ? "Sim" : "Não" });
    }

    // ── Urgência ──
    const urgRaw = (r["Urgente"] ?? "").trim();
    const prazoCell = parseDateCell(r["Prazo da Urgência"] ?? "");
    if (!prazoCell.ok) dateError = "Prazo da Urgência inválido.";
    const motivoRaw = (r["Motivo da Urgência"] ?? "").trim();
    if (urgRaw) {
      const urg = parseBoolPt(urgRaw);
      if (urg === true) {
        const prazoIso = prazoCell.ok ? prazoCell.iso : null;
        if (!prazoIso) {
          report.invalidRows.push({ csvRow, codigo: codeCell, construtora: constrCell, obra: obraCell, reason: "urgencia-sem-prazo", detail: "Urgente = Sim exige Prazo da Urgência." });
          return;
        }
        if (!project.urgente || prazoIso !== project.prazoUrgencia) {
          data.priority = "URGENTE";
          data.urgentDeadline = isoToDate(prazoIso);
          changes.push({ field: "urgente", label: "Urgente", from: project.urgente ? "Sim" : "Não", to: "Sim" });
          if (prazoIso !== project.prazoUrgencia) changes.push({ field: "prazo_urgencia", label: "Prazo da Urgência", from: project.prazoUrgencia, to: prazoIso });
        }
        // motivo opcional
        const motivo = motivoRaw || null;
        if (motivo !== (project.motivoUrgencia || null)) {
          data.urgentReason = motivo;
          changes.push({ field: "motivo_urgencia", label: "Motivo da Urgência", from: project.motivoUrgencia, to: motivo });
        }
      } else if (urg === false) {
        if (project.urgente) {
          data.priority = "NORMAL";
          data.urgentDeadline = null;
          data.urgentReason = null;
          changes.push({ field: "urgente", label: "Urgente", from: "Sim", to: "Não" });
        }
      }
    }

    if (dateError) {
      report.invalidRows.push({ csvRow, codigo: codeCell, construtora: constrCell, obra: obraCell, reason: "data-invalida", detail: dateError });
      return;
    }

    // ── Status (read-only — só aviso) ──
    let statusWarning: ExcelMatchedProject["statusWarning"];
    const statusCell = (r["Status"] ?? "").trim();
    if (statusCell) {
      const csvDb = UI_TO_DB_STATUS[statusCell as keyof typeof UI_TO_DB_STATUS];
      const atualLabel = DB_TO_UI_STATUS[project.status as DbStatus] ?? project.status;
      if (csvDb && csvDb !== project.status) {
        statusWarning = { csv: statusCell, atual: atualLabel };
      }
    }

    // ── Nova Observação (não duplica; "Última Observação" é ignorada) ──
    const novaObs = (r["Nova Observação"] ?? "").trim();
    const observationToAdd = novaObs && !project.observationTexts.includes(normalizeName(novaObs)) ? novaObs : null;

    touched.add(project.id);

    const hasChange = changes.length > 0 || observationToAdd !== null;
    if (hasChange) {
      plan.updates.push({ projectId: project.id, data, observationToAdd });
    }
    report.matched.push({
      projectId: project.id,
      matchedBy: res.matchedBy,
      codigo: project.code,
      construtora: project.constructorName ?? constrCell,
      obra: project.workName ?? obraCell,
      csvRow,
      changes,
      pendingRefs,
      statusWarning,
      observationToAdd,
    });
  });

  report.sellersNotFound = [...sellersNF].sort();
  report.equipmentNotFound = [...equipNF].sort();
  report.cabinTypesNotFound = [...cabinNF].sort();
  return { plan, report };
}

export { stripDots, normalizeCabin };
