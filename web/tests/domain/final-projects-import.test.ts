import { describe, expect, it } from "vitest";
import {
  analyzeFinalProjects,
  workKey,
  type MatchSnapshot,
  type SnapshotProject,
} from "@/features/import/domain/final-projects-match";
import { normalizeName, normalizeCode } from "@/features/import/domain/import-normalize";
import type { FinalProjectsReport } from "@/features/import/domain/final-projects-import-types";

// ─── Helpers de construção do snapshot ────────────────────────────────────────

function makeProject(over: Partial<SnapshotProject> & { id: string; constructorName: string; workName: string }): SnapshotProject {
  return {
    code: "CRE-TMP-0001",
    status: "PROJETO_FINAL_ENVIADO",
    sellerName: null,
    equipmentCode: null,
    cabinTypeName: null,
    engineerName: null,
    engineerPhone: null,
    observationTexts: [],
    ...over,
  };
}

function buildSnapshot(opts: {
  projects: SnapshotProject[];
  sellers?: { id: string; name: string }[];
  equipment?: { id: string; code: string }[];
  cabinTypes?: { id: string; name: string }[];
}): MatchSnapshot {
  // Reaproveita normalizações públicas do módulo via workKey + helpers internos
  // replicados aqui de forma mínima (mesma lógica do service).
  const stripDots = (s: string) => s.replace(/\./g, "").replace(/\s+/g, " ").trim();
  const normalizeCabin = (raw: string) =>
    normalizeName(raw).replace(/\.\s*$/, "").replace(/c\.o\./g, "c.o").replace(/\s*\+\s*/g, " + ").trim();

  const projectsByWork = new Map<string, SnapshotProject[]>();
  const codeOwner = new Map<string, string>();
  for (const p of opts.projects) {
    codeOwner.set(p.code.toUpperCase(), p.id);
    const key = workKey(p.constructorName, p.workName);
    const list = projectsByWork.get(key);
    if (list) list.push(p);
    else projectsByWork.set(key, [p]);
  }

  const sellers = new Map<string, { id: string; displayName: string }>();
  (opts.sellers ?? []).forEach((s) => sellers.set(stripDots(normalizeName(s.name)), { id: s.id, displayName: s.name }));
  const equipment = new Map<string, { id: string; displayName: string }>();
  (opts.equipment ?? []).forEach((e) => equipment.set(normalizeCode(e.code), { id: e.id, displayName: e.code }));
  const cabinTypes = new Map<string, { id: string; displayName: string }>();
  (opts.cabinTypes ?? []).forEach((c) => cabinTypes.set(normalizeCabin(c.name), { id: c.id, displayName: c.name }));

  return { projectsByWork, codeOwner, sellers, equipment, cabinTypes };
}

function emptyReport(): FinalProjectsReport {
  return {
    dryRun: true,
    diagnostic: { delimiter: ";", delimiterLabel: "ponto-e-vírgula (;)", columns: [], firstRow: null },
    rowsRead: 0,
    projectsInScope: 0,
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

function run(rows: Record<string, string>[], snap: MatchSnapshot) {
  return analyzeFinalProjects(rows, snap, emptyReport());
}

// ─── Testes ────────────────────────────────────────────────────────────────────

describe("enriquecimento de projetos finais — matching por construtora + obra", () => {
  it("1. projeto em PROJETO_FINAL_ENVIADO encontrado: atualiza código, vendedor, equipamento, cabine, engenheiro e telefone", () => {
    const snap = buildSnapshot({
      projects: [makeProject({ id: "p1", constructorName: "CURY", workName: "URBAN VILA MARIA T.4", code: "CRE-TMP-0573", status: "PROJETO_FINAL_ENVIADO" })],
      sellers: [{ id: "s1", name: "ÉRICA" }],
      equipment: [{ id: "e1", code: "CH-20/30" }],
      cabinTypes: [{ id: "c1", name: "SIMPLES" }],
    });
    const { plan, report } = run([{
      CONSTRUTORA: "CURY", OBRA: "URBAN VILA MARIA T.4", "ENG. ENGENHEIRO": "ENG.  GABRIEL MURADE",
      CELULAR: "(11) 98163-7993", EQUIP: "CH-20/30", "VARIAÇÃO": "SIMPLES",
      "PROJETOS BASE": "CRE-VIL-1513", VENDEDOR: "ÉRICA", FINAL: "27/01/2025", "OBSERVAÇÕES": "posição JPEG",
    }], snap);

    expect(report.matched).toHaveLength(1);
    expect(plan.updates).toHaveLength(1);
    const u = plan.updates[0];
    expect(u.data.code).toBe("CRE-VIL-1513");
    expect(u.data.sellerId).toBe("s1");
    expect(u.data.equipmentId).toBe("e1");
    expect(u.data.cabinTypeId).toBe("c1");
    expect(u.data.engineerName).toBe("GABRIEL MURADE");
    expect(u.data.engineerPhone).toBe("11981637993");
    expect(u.observationToAdd).toContain("posição JPEG");
    expect(u.observationToAdd).toContain("Final: 27/01/2025");
  });

  it("2. projeto em PROJETO_APROVADO encontrado: atualiza os campos permitidos", () => {
    const snap = buildSnapshot({
      projects: [makeProject({ id: "p2", constructorName: "EZTEC", workName: "RESERVA SAO CAETANO", code: "CRE-TMP-0573", status: "PROJETO_APROVADO" })],
      sellers: [{ id: "s1", name: "Carlos Romano" }],
    });
    const { plan, report } = run([{
      CONSTRUTORA: "EZTEC", OBRA: "RESERVA SAO CAETANO", VENDEDOR: "Carlos Romano", "PROJETOS BASE": "CRE-RES-2051",
    }], snap);

    expect(report.matched).toHaveLength(1);
    expect(plan.updates[0].data.code).toBe("CRE-RES-2051");
    expect(plan.updates[0].data.sellerId).toBe("s1");
    expect(report.matched[0].statusLabel).toBe("PROJETO APROVADO");
  });

  it("3. código da planilha (PROJETOS BASE) sobrescreve o provisório do sistema", () => {
    const snap = buildSnapshot({
      projects: [makeProject({ id: "p3", constructorName: "CURY", workName: "OBRA X", code: "CRE-TMP-0573" })],
    });
    const { plan } = run([{ CONSTRUTORA: "CURY", OBRA: "OBRA X", "PROJETOS BASE": "CRE-RES-2053" }], snap);
    expect(plan.updates[0].data.code).toBe("CRE-RES-2053");
    expect(plan.updates[0].observationToAdd).toBeNull();
  });

  it("4. código duplicado em OUTRO projeto gera conflito e não atualiza", () => {
    const snap = buildSnapshot({
      projects: [
        makeProject({ id: "p4", constructorName: "CURY", workName: "OBRA X", code: "CRE-TMP-0573" }),
        makeProject({ id: "other", constructorName: "OUTRA", workName: "OBRA Y", code: "CRE-RES-2053" }),
      ],
    });
    const { plan, report } = run([{ CONSTRUTORA: "CURY", OBRA: "OBRA X", "PROJETOS BASE": "CRE-RES-2053" }], snap);
    expect(plan.updates).toHaveLength(0);
    expect(report.duplicateCodes).toHaveLength(1);
    expect(report.duplicateCodes[0].detail).toContain("CRE-RES-2053");
  });

  it("5. projeto em outro status gera fora-do-escopo", () => {
    const snap = buildSnapshot({
      projects: [makeProject({ id: "p5", constructorName: "CURY", workName: "OBRA X", status: "ELABORAR_ANTE_PROJETO" })],
    });
    const { plan, report } = run([{ CONSTRUTORA: "CURY", OBRA: "OBRA X", "PROJETOS BASE": "CRE-RES-1" }], snap);
    expect(plan.updates).toHaveLength(0);
    expect(report.outOfScope).toHaveLength(1);
    expect(report.outOfScope[0].detail).toContain("outro status");
  });

  it("6. construtora + obra não encontrada gera não-encontrado", () => {
    const snap = buildSnapshot({ projects: [] });
    const { plan, report } = run([{ CONSTRUTORA: "INEXISTENTE", OBRA: "NADA", "PROJETOS BASE": "X" }], snap);
    expect(plan.updates).toHaveLength(0);
    expect(report.notFound).toHaveLength(1);
  });

  it("7. mais de um projeto no escopo para a mesma construtora+obra gera conflito", () => {
    const snap = buildSnapshot({
      projects: [
        makeProject({ id: "a", constructorName: "CURY", workName: "OBRA X", code: "C1", status: "PROJETO_FINAL_ENVIADO" }),
        makeProject({ id: "b", constructorName: "CURY", workName: "OBRA X", code: "C2", status: "PROJETO_APROVADO" }),
      ],
    });
    const { plan, report } = run([{ CONSTRUTORA: "CURY", OBRA: "OBRA X", VENDEDOR: "Z" }], snap);
    expect(plan.updates).toHaveLength(0);
    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0].detail).toContain("2 projetos");
  });

  it("normaliza acentos/caixa/espaços e alias & / E na chave construtora+obra", () => {
    const snap = buildSnapshot({
      projects: [makeProject({ id: "p", constructorName: "PLANO & PLANO", workName: "PORTAL PACAEMBU", code: "C1" })],
    });
    // CSV traz acento/caixa/espacos diferentes
    const { plan } = run([{ CONSTRUTORA: "plano & plano ", OBRA: "  Portal Pacaembu ", "PROJETOS BASE": "CRE-PAC-1" }], snap);
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].data.code).toBe("CRE-PAC-1");
  });

  it("vendedor/equipamento/cabine não encontrados: pula só o campo e atualiza o resto", () => {
    const snap = buildSnapshot({
      projects: [makeProject({ id: "p", constructorName: "CURY", workName: "OBRA X", code: "CRE-TMP-1" })],
      // sem cadastros mestres
    });
    const { plan, report } = run([{
      CONSTRUTORA: "CURY", OBRA: "OBRA X", "PROJETOS BASE": "CRE-RES-9",
      VENDEDOR: "FULANO", EQUIP: "XYZ-99", "VARIAÇÃO": "INEXISTENTE",
    }], snap);
    expect(plan.updates).toHaveLength(1);
    // código aplicado; refs ausentes não entram em data
    expect(plan.updates[0].data.code).toBe("CRE-RES-9");
    expect(plan.updates[0].data.sellerId).toBeUndefined();
    expect(plan.updates[0].data.equipmentId).toBeUndefined();
    expect(plan.updates[0].data.cabinTypeId).toBeUndefined();
    expect(report.sellersNotFound).toContain("FULANO");
    expect(report.equipmentNotFound).toContain("XYZ-99");
    expect(report.cabinTypesNotFound).toContain("INEXISTENTE");
    expect(report.matched[0].pendingRefs).toHaveLength(3);
  });

  it("12. observação não duplica se já existir idêntica no projeto", () => {
    const snap = buildSnapshot({
      projects: [makeProject({
        id: "p", constructorName: "CURY", workName: "OBRA X", code: "C1",
        observationTexts: [normalizeName("posição JPEG na pasta")],
      })],
    });
    const { plan } = run([{ CONSTRUTORA: "CURY", OBRA: "OBRA X", "OBSERVAÇÕES": "posição JPEG na pasta" }], snap);
    // só observação, que já existe → nada a atualizar
    expect(plan.updates).toHaveLength(0);
    expect(plan.updates.some((u) => u.observationToAdd)).toBe(false);
  });

  it("match único sem mudanças reais: registra em matched mas não gera update", () => {
    const snap = buildSnapshot({
      projects: [makeProject({ id: "p", constructorName: "CURY", workName: "OBRA X", code: "CRE-RES-1" })],
    });
    // PROJETOS BASE igual ao código atual, sem outros campos
    const { plan, report } = run([{ CONSTRUTORA: "CURY", OBRA: "OBRA X", "PROJETOS BASE": "CRE-RES-1" }], snap);
    expect(report.matched).toHaveLength(1);
    expect(plan.updates).toHaveLength(0);
  });

  it("linha inválida: construtora ou obra em branco", () => {
    const snap = buildSnapshot({ projects: [] });
    const { report } = run([{ CONSTRUTORA: "", OBRA: "ALGO", "PROJETOS BASE": "X" }], snap);
    expect(report.invalidRows).toHaveLength(1);
  });

  it("duas linhas do CSV apontando para o mesmo projeto: segunda vira conflito", () => {
    const snap = buildSnapshot({
      projects: [makeProject({ id: "p", constructorName: "CURY", workName: "OBRA X", code: "CRE-TMP-1" })],
    });
    const { plan, report } = run([
      { CONSTRUTORA: "CURY", OBRA: "OBRA X", "PROJETOS BASE": "CRE-RES-1" },
      { CONSTRUTORA: "CURY", OBRA: "OBRA X", VENDEDOR: "Z" },
    ], snap);
    expect(plan.updates).toHaveLength(1);
    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0].detail).toContain("mesmo projeto");
  });
});
