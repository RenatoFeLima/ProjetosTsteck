// Núcleo PURO do enriquecimento de projetos finais/aprovados (sem Prisma).
// Recebe as linhas do CSV + um snapshot do banco e produz um plano de
// atualização + relatório. Não grava nada. Coberto por testes unitários.
//
// Chave de match: CONSTRUTORA + OBRA (normalizadas). Nunca por código.
// Escopo: somente projetos em PROJETO_FINAL_ENVIADO e PROJETO_APROVADO.

import { normalizeName, normalizeCode, cleanEngineerName, onlyDigits } from "./import-normalize";
import { canonicalConstructorName } from "./import-aliases";
import type {
  FinalProjectsReport,
  FinalProjectMatch,
  FieldChange,
} from "./final-projects-import-types";

// Status (DB enum) dentro do escopo do enriquecimento.
export const FINAL_SCOPE_STATUSES = ["PROJETO_FINAL_ENVIADO", "PROJETO_APROVADO"] as const;
export type FinalScopeStatus = (typeof FINAL_SCOPE_STATUSES)[number];

// ─── Estruturas do snapshot (preenchidas pelo service a partir do Prisma) ──────

export type SnapshotProject = {
  id: string;
  code: string;
  status: string; // DB enum (qualquer status — usamos para detectar "fora do escopo")
  constructorName: string;
  workName: string;
  sellerName: string | null;
  equipmentCode: string | null;
  cabinTypeName: string | null;
  engineerName: string | null;
  engineerPhone: string | null;
  /** Textos de observações já existentes (normalizados) — para não duplicar. */
  observationTexts: string[];
};

export type NamedRef = { id: string; displayName: string };

export type MatchSnapshot = {
  /** Todos os projetos (qualquer status) indexados por construtora+obra normalizadas. */
  projectsByWork: Map<string, SnapshotProject[]>;
  /** Código UPPER → projectId (todos os projetos) para detectar duplicidade. */
  codeOwner: Map<string, string>;
  sellers: Map<string, NamedRef>; // stripDots(normName) -> ref
  equipment: Map<string, NamedRef>; // normalizeCode -> ref
  cabinTypes: Map<string, NamedRef>; // normalizeCabin -> ref
};

// ─── Plano (o que o service vai gravar) ───────────────────────────────────────

export type PlannedUpdate = {
  projectId: string;
  /** Campos a setar no Prisma (somente os que mudam). */
  data: {
    code?: string;
    sellerId?: string;
    equipmentId?: string;
    cabinTypeId?: string;
    engineerName?: string;
    engineerPhone?: string;
  };
  observationToAdd: string | null;
};

export type MatchPlan = { updates: PlannedUpdate[] };

// ─── Helpers de matching (alinhados ao anteProjetoImportService) ──────────────

function stripDots(s: string): string {
  return s.replace(/\./g, "").replace(/\s+/g, " ").trim();
}

function normalizeCabin(raw: string): string {
  return normalizeName(raw)
    .replace(/\.\s*$/, "")
    .replace(/c\.o\./g, "c.o")
    .replace(/\s*\+\s*/g, " + ")
    .trim();
}

/** Chave de obra: usa nome canônico da construtora (alias) + obra, normalizados. */
export function workKey(construtoraRaw: string, obraRaw: string): string {
  const constructor = canonicalConstructorName(construtoraRaw.trim());
  return `${normalizeName(constructor)}::${normalizeName(obraRaw)}`;
}

function matchSeller(raw: string, snap: MatchSnapshot): NamedRef | null {
  if (!raw) return null;
  const norm = stripDots(normalizeName(raw));
  const exact = snap.sellers.get(norm);
  if (exact) return exact;
  for (const [key, entry] of snap.sellers) {
    if (key.startsWith(norm) || norm.startsWith(key)) return entry;
  }
  return null;
}

function matchEquipment(raw: string, snap: MatchSnapshot): NamedRef | null {
  if (!raw || normalizeName(raw) === "nao encontrado") return null;
  return snap.equipment.get(normalizeCode(raw)) ?? null;
}

function matchCabinType(raw: string, snap: MatchSnapshot): NamedRef | null {
  if (!raw || normalizeName(raw) === "nao encontrado") return null;
  return snap.cabinTypes.get(normalizeCabin(raw)) ?? null;
}

const STATUS_LABEL: Record<string, string> = {
  PROJETO_FINAL_ENVIADO: "PROJETO FINAL ENVIADO",
  PROJETO_APROVADO: "PROJETO APROVADO",
};

function isInScope(status: string): status is FinalScopeStatus {
  return (FINAL_SCOPE_STATUSES as readonly string[]).includes(status);
}

// ─── Núcleo: analyze ──────────────────────────────────────────────────────────

export function analyzeFinalProjects(
  rows: Record<string, string>[],
  snap: MatchSnapshot,
  emptyReport: FinalProjectsReport,
): { plan: MatchPlan; report: FinalProjectsReport } {
  const report = emptyReport;
  const plan: MatchPlan = { updates: [] };

  // Códigos a aplicar neste run (para detectar colisão entre linhas do próprio CSV).
  const codesClaimedInRun = new Map<string, number>(); // codeUpper -> csvRow
  // Evita atualizar o mesmo projeto duas vezes no mesmo run.
  const projectsTouched = new Set<string>();

  const sellersNotFound = new Set<string>();
  const equipmentNotFound = new Set<string>();
  const cabinTypesNotFound = new Set<string>();

  rows.forEach((r, idx) => {
    const csvRow = idx + 1;
    const construtoraRaw = (r["CONSTRUTORA"] ?? "").trim();
    const obraRaw = (r["OBRA"] ?? "").trim();

    if (!construtoraRaw || !obraRaw) {
      report.invalidRows.push({
        csvRow,
        construtora: construtoraRaw,
        obra: obraRaw,
        reason: "linha-invalida",
        detail: "CONSTRUTORA ou OBRA em branco.",
      });
      return;
    }

    const key = workKey(construtoraRaw, obraRaw);
    const candidates = snap.projectsByWork.get(key) ?? [];

    if (candidates.length === 0) {
      report.notFound.push({
        csvRow,
        construtora: construtoraRaw,
        obra: obraRaw,
        reason: "nao-encontrado",
        detail: "Nenhum projeto com esta construtora + obra.",
      });
      return;
    }

    const inScope = candidates.filter((p) => isInScope(p.status));

    if (inScope.length === 0) {
      // Existe(m) projeto(s) com essa construtora+obra, mas fora dos status alvo.
      const statuses = [...new Set(candidates.map((p) => STATUS_LABEL[p.status] ?? p.status))].join(", ");
      report.outOfScope.push({
        csvRow,
        construtora: construtoraRaw,
        obra: obraRaw,
        reason: "fora-do-escopo",
        detail: `Projeto existe mas em outro status: ${statuses}.`,
      });
      return;
    }

    if (inScope.length > 1) {
      report.conflicts.push({
        csvRow,
        construtora: construtoraRaw,
        obra: obraRaw,
        reason: "conflito-multiplos",
        detail: `${inScope.length} projetos no escopo para a mesma construtora + obra.`,
      });
      return;
    }

    const project = inScope[0];

    if (projectsTouched.has(project.id)) {
      report.conflicts.push({
        csvRow,
        construtora: construtoraRaw,
        obra: obraRaw,
        reason: "conflito-multiplos",
        detail: "Mais de uma linha do CSV aponta para o mesmo projeto.",
      });
      return;
    }

    // ── Código (PROJETOS BASE) ──
    const csvCode = (r["PROJETOS BASE"] ?? "").trim();
    const data: PlannedUpdate["data"] = {};
    const changes: FieldChange[] = [];

    if (csvCode) {
      const up = csvCode.toUpperCase();
      const owner = snap.codeOwner.get(up);
      const claimedBy = codesClaimedInRun.get(up);
      const codeIsDuplicate =
        (owner !== undefined && owner !== project.id) ||
        (claimedBy !== undefined && claimedBy !== csvRow);
      if (codeIsDuplicate) {
        report.duplicateCodes.push({
          csvRow,
          construtora: construtoraRaw,
          obra: obraRaw,
          reason: "codigo-duplicado",
          detail: `Código "${csvCode}" já pertence a outro projeto.`,
        });
        return; // não atualiza nada deste projeto — revisão manual
      }
      if (csvCode !== project.code) {
        data.code = csvCode;
        codesClaimedInRun.set(up, csvRow);
        changes.push({ field: "codigo", label: "Código", from: project.code, to: csvCode });
      }
    }

    // ── Vendedor ──
    const vendedorRaw = (r["VENDEDOR"] ?? "").trim();
    const pendingRefs: FinalProjectMatch["pendingRefs"] = [];
    if (vendedorRaw) {
      const ref = matchSeller(vendedorRaw, snap);
      if (ref) {
        if (normalizeName(ref.displayName) !== normalizeName(project.sellerName ?? "")) {
          data.sellerId = ref.id;
          changes.push({ field: "vendedor", label: "Vendedor", from: project.sellerName, to: ref.displayName });
        }
      } else {
        sellersNotFound.add(vendedorRaw);
        pendingRefs.push({ field: "vendedor", valor: vendedorRaw });
      }
    }

    // ── Equipamento ──
    const equipRaw = (r["EQUIP"] ?? "").trim();
    if (equipRaw && normalizeName(equipRaw) !== "nao encontrado") {
      const ref = matchEquipment(equipRaw, snap);
      if (ref) {
        if (normalizeCode(ref.displayName) !== normalizeCode(project.equipmentCode ?? "")) {
          data.equipmentId = ref.id;
          changes.push({ field: "equipamento", label: "Equipamento", from: project.equipmentCode, to: ref.displayName });
        }
      } else {
        equipmentNotFound.add(equipRaw);
        pendingRefs.push({ field: "equipamento", valor: equipRaw });
      }
    }

    // ── Tipo de cabine (VARIAÇÃO) ──
    const cabineRaw = (r["VARIAÇÃO"] ?? "").trim();
    if (cabineRaw && normalizeName(cabineRaw) !== "nao encontrado") {
      const ref = matchCabinType(cabineRaw, snap);
      if (ref) {
        if (normalizeName(ref.displayName) !== normalizeName(project.cabinTypeName ?? "")) {
          data.cabinTypeId = ref.id;
          changes.push({ field: "tipo_cabine", label: "Tipo de cabine", from: project.cabinTypeName, to: ref.displayName });
        }
      } else {
        cabinTypesNotFound.add(cabineRaw);
        pendingRefs.push({ field: "tipo_cabine", valor: cabineRaw });
      }
    }

    // ── Engenheiro (inline) ──
    const engName = cleanEngineerName(r["ENG. ENGENHEIRO"] ?? "");
    if (engName && normalizeName(engName) !== normalizeName(project.engineerName ?? "")) {
      data.engineerName = engName;
      changes.push({ field: "engenheiro", label: "Engenheiro", from: project.engineerName, to: engName });
    }

    // ── Telefone (inline) ──
    const phoneDigits = onlyDigits(r["CELULAR"] ?? "");
    if (phoneDigits && phoneDigits !== onlyDigits(project.engineerPhone ?? "")) {
      data.engineerPhone = phoneDigits;
      changes.push({ field: "telefone", label: "Telefone", from: project.engineerPhone, to: phoneDigits });
    }

    // ── Observação (OBSERVAÇÕES + FINAL) ──
    const obsRaw = (r["OBSERVAÇÕES"] ?? "").trim();
    const finalRaw = (r["FINAL"] ?? "").trim();
    const obsParts: string[] = [];
    if (obsRaw) obsParts.push(obsRaw);
    if (finalRaw) obsParts.push(`Final: ${finalRaw}`);
    const obsText = obsParts.join(" — ") || null;
    // Não duplica observação idêntica (comparação normalizada).
    let observationToAdd: string | null = null;
    if (obsText && !project.observationTexts.includes(normalizeName(obsText))) {
      observationToAdd = obsText;
    }

    const hasChanges = changes.length > 0 || observationToAdd !== null;
    if (!hasChanges) {
      // Match único, mas nada a alterar — registra como "encontrado sem mudanças".
      report.matched.push({
        projectId: project.id,
        construtora: project.constructorName || construtoraRaw,
        obra: project.workName || obraRaw,
        statusLabel: STATUS_LABEL[project.status] ?? project.status,
        csvRow,
        changes: [],
        pendingRefs,
        observationToAdd: null,
      });
      projectsTouched.add(project.id);
      return;
    }

    projectsTouched.add(project.id);
    plan.updates.push({ projectId: project.id, data, observationToAdd });
    report.matched.push({
      projectId: project.id,
      construtora: project.constructorName || construtoraRaw,
      obra: project.workName || obraRaw,
      statusLabel: STATUS_LABEL[project.status] ?? project.status,
      csvRow,
      changes,
      pendingRefs,
      observationToAdd,
    });
  });

  report.sellersNotFound = [...sellersNotFound].sort();
  report.equipmentNotFound = [...equipmentNotFound].sort();
  report.cabinTypesNotFound = [...cabinTypesNotFound].sort();

  return { plan, report };
}

export { stripDots, normalizeCabin };
