import { describe, expect, it } from "vitest";
import {
  analyzeProjectsExcel,
  excelWorkKey,
  type ExcelMatchSnapshot,
  type ExcelSnapshotProject,
} from "@/features/import/domain/projects-excel-match";
import { normalizeName, normalizeCode } from "@/features/import/domain/import-normalize";
import { ID_HEADER } from "@/features/projects/domain/project-export";
import type { ProjectsExcelImportReport } from "@/features/import/domain/projects-excel-import-types";

function makeProject(over: Partial<ExcelSnapshotProject> & { id: string }): ExcelSnapshotProject {
  return {
    code: "CRE-ABC-1234",
    status: "PROJETO_FINAL_ENVIADO",
    constructorName: "CURY",
    workName: "OBRA X",
    sellerName: null,
    equipmentCode: null,
    cabinTypeName: null,
    engineerName: null,
    engineerPhone: null,
    dataLancamento: "2026-01-10",
    projetoObraRecebido: false,
    localCabineDefinido: false,
    alinhamentoConcluido: false,
    dataAlinhamento: null,
    urgente: false,
    prazoUrgencia: null,
    motivoUrgencia: null,
    observationTexts: [],
    ...over,
  };
}

function buildSnapshot(opts: {
  projects: ExcelSnapshotProject[];
  sellers?: { id: string; name: string }[];
  equipment?: { id: string; code: string }[];
  cabinTypes?: { id: string; name: string }[];
}): ExcelMatchSnapshot {
  const stripDots = (s: string) => s.replace(/\./g, "").replace(/\s+/g, " ").trim();
  const normalizeCabin = (raw: string) => normalizeName(raw).replace(/\.\s*$/, "").replace(/c\.o\./g, "c.o").replace(/\s*\+\s*/g, " + ").trim();

  const byId = new Map<string, ExcelSnapshotProject>();
  const byCode = new Map<string, ExcelSnapshotProject[]>();
  const byWork = new Map<string, ExcelSnapshotProject[]>();
  const codeOwner = new Map<string, string>();
  const push = (m: Map<string, ExcelSnapshotProject[]>, k: string, v: ExcelSnapshotProject) => {
    const l = m.get(k); if (l) l.push(v); else m.set(k, [v]);
  };
  for (const p of opts.projects) {
    byId.set(p.id, p);
    const cu = p.code.toUpperCase();
    codeOwner.set(cu, p.id);
    push(byCode, cu, p);
    if (p.constructorName && p.workName) push(byWork, excelWorkKey(p.constructorName, p.workName), p);
  }
  const sellers = new Map<string, { id: string; displayName: string }>();
  (opts.sellers ?? []).forEach((s) => sellers.set(stripDots(normalizeName(s.name)), { id: s.id, displayName: s.name }));
  const equipment = new Map<string, { id: string; displayName: string }>();
  (opts.equipment ?? []).forEach((e) => equipment.set(normalizeCode(e.code), { id: e.id, displayName: e.code }));
  const cabinTypes = new Map<string, { id: string; displayName: string }>();
  (opts.cabinTypes ?? []).forEach((c) => cabinTypes.set(normalizeCabin(c.name), { id: c.id, displayName: c.name }));
  return { byId, byCode, byWork, codeOwner, sellers, equipment, cabinTypes };
}

function emptyReport(): ProjectsExcelImportReport {
  return {
    dryRun: true,
    diagnostic: { delimiter: ";", delimiterLabel: "ponto-e-vírgula (;)", columns: [], hasIdColumn: true },
    rowsRead: 0, matched: [], notFound: [], conflicts: [], duplicateCodes: [], invalidRows: [],
    sellersNotFound: [], equipmentNotFound: [], cabinTypesNotFound: [],
  };
}

function run(rows: Record<string, string>[], snap: ExcelMatchSnapshot) {
  return analyzeProjectsExcel(rows, snap, emptyReport());
}

describe("reimportação Excel — matching e regras", () => {
  it("1+2. localiza por ID do Projeto e atualiza campos editáveis", () => {
    const snap = buildSnapshot({
      projects: [makeProject({ id: "p1" })],
      sellers: [{ id: "s1", name: "LUCIANO" }],
      equipment: [{ id: "e1", code: "CH-20/30" }],
      cabinTypes: [{ id: "c1", name: "SIMPLES" }],
    });
    const { plan, report } = run([{
      [ID_HEADER]: "p1", "Código": "CRE-ABC-1234", "Vendedor": "LUCIANO", "Equipamento": "CH 20/30",
      "Tipo de Cabine": "SIMPLES", "Telefone": "11999999999",
    }], snap);
    expect(report.matched[0].matchedBy).toBe("id");
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].data.sellerId).toBe("s1");
    expect(plan.updates[0].data.equipmentId).toBe("e1");
    expect(plan.updates[0].data.cabinTypeId).toBe("c1");
    expect(plan.updates[0].data.engineerPhone).toBe("11999999999");
  });

  it("3. não cria projeto se ID não existir (nao-encontrado)", () => {
    const snap = buildSnapshot({ projects: [makeProject({ id: "p1" })] });
    const { plan, report } = run([{ [ID_HEADER]: "inexistente", "Vendedor": "X" }], snap);
    expect(plan.updates).toHaveLength(0);
    expect(report.notFound).toHaveLength(1);
    expect(report.notFound[0].detail).toContain("não existe");
  });

  it("4. bloqueia código duplicado de outro projeto", () => {
    const snap = buildSnapshot({
      projects: [
        makeProject({ id: "p1", code: "CRE-AAA-1" }),
        makeProject({ id: "p2", code: "CRE-BBB-2", workName: "OBRA Y" }),
      ],
    });
    const { plan, report } = run([{ [ID_HEADER]: "p1", "Código": "CRE-BBB-2" }], snap);
    expect(plan.updates).toHaveLength(0);
    expect(report.duplicateCodes).toHaveLength(1);
  });

  it("5. status no CSV diferente do banco gera aviso, NÃO altera status", () => {
    const snap = buildSnapshot({ projects: [makeProject({ id: "p1", status: "PROJETO_FINAL_ENVIADO" })] });
    const { plan, report } = run([{ [ID_HEADER]: "p1", "Status": "PROJETO APROVADO", "Vendedor": "" }], snap);
    expect(report.matched[0].statusWarning).toEqual({ csv: "PROJETO APROVADO", atual: "PROJETO FINAL ENVIADO" });
    // sem mudança real → sem update; e nenhum campo de status no plano
    expect(plan.updates).toHaveLength(0);
  });

  it("6. campo vazio no CSV não apaga valor existente", () => {
    const snap = buildSnapshot({ projects: [makeProject({ id: "p1", engineerName: "BRUNO", sellerName: "ÉRICA" })], sellers: [{ id: "s1", name: "ÉRICA" }] });
    const { plan } = run([{ [ID_HEADER]: "p1", "Vendedor": "", "Engenheiro": "", "Telefone": "" }], snap);
    expect(plan.updates).toHaveLength(0);
  });

  it("7. urgência com prazo: seta priority + prazo", () => {
    const snap = buildSnapshot({ projects: [makeProject({ id: "p1", urgente: false })] });
    const { plan } = run([{ [ID_HEADER]: "p1", "Urgente": "Sim", "Prazo da Urgência": "25/06/2026", "Motivo da Urgência": "cliente" }], snap);
    expect(plan.updates[0].data.priority).toBe("URGENTE");
    expect((plan.updates[0].data.urgentDeadline as Date).toISOString().slice(0, 10)).toBe("2026-06-25");
    expect(plan.updates[0].data.urgentReason).toBe("cliente");
  });

  it("8. urgência sem prazo é bloqueada", () => {
    const snap = buildSnapshot({ projects: [makeProject({ id: "p1" })] });
    const { plan, report } = run([{ [ID_HEADER]: "p1", "Urgente": "Sim", "Prazo da Urgência": "" }], snap);
    expect(plan.updates).toHaveLength(0);
    expect(report.invalidRows[0].reason).toBe("urgencia-sem-prazo");
  });

  it("9. Urgente = Não limpa prazo e motivo", () => {
    const snap = buildSnapshot({ projects: [makeProject({ id: "p1", urgente: true, prazoUrgencia: "2026-12-31", motivoUrgencia: "x" })] });
    const { plan } = run([{ [ID_HEADER]: "p1", "Urgente": "Não" }], snap);
    expect(plan.updates[0].data.priority).toBe("NORMAL");
    expect(plan.updates[0].data.urgentDeadline).toBeNull();
    expect(plan.updates[0].data.urgentReason).toBeNull();
  });

  it("10. data inválida bloqueia a linha", () => {
    const snap = buildSnapshot({ projects: [makeProject({ id: "p1" })] });
    const { plan, report } = run([{ [ID_HEADER]: "p1", "Data do Alinhamento": "31/31/2026" }], snap);
    expect(plan.updates).toHaveLength(0);
    expect(report.invalidRows[0].reason).toBe("data-invalida");
  });

  it("aceita booleanos Sim/Não/TRUE/1 e atualiza flags", () => {
    const snap = buildSnapshot({ projects: [makeProject({ id: "p1", projetoObraRecebido: false, localCabineDefinido: false, alinhamentoConcluido: false })] });
    const { plan } = run([{ [ID_HEADER]: "p1", "Projeto de Obra Recebido": "Sim", "Local da Cabine Definido": "TRUE", "Alinhamento Concluído": "1" }], snap);
    expect(plan.updates[0].data.projectReceived).toBe(true);
    expect(plan.updates[0].data.cabinLocationDefined).toBe(true);
    expect(plan.updates[0].data.alignmentCompleted).toBe(true);
  });

  it("fallback por código único quando não há ID", () => {
    const snap = buildSnapshot({ projects: [makeProject({ id: "p1", code: "CRE-ZZZ-9" })], sellers: [{ id: "s1", name: "LUCIANO" }] });
    const { plan, report } = run([{ "Código": "CRE-ZZZ-9", "Vendedor": "LUCIANO" }], snap);
    expect(report.matched[0].matchedBy).toBe("codigo");
    expect(plan.updates[0].data.sellerId).toBe("s1");
  });

  it("fallback por construtora+obra quando não há ID nem código", () => {
    const snap = buildSnapshot({ projects: [makeProject({ id: "p1", constructorName: "EZTEC", workName: "RESERVA" })], sellers: [{ id: "s1", name: "LUCIANO" }] });
    const { report } = run([{ "Construtora": "EZTEC", "Obra": "RESERVA", "Vendedor": "LUCIANO" }], snap);
    expect(report.matched[0].matchedBy).toBe("construtora_obra");
  });

  it("15. nova observação não duplica se já existir idêntica", () => {
    const obs = "ligar para o cliente";
    const snap = buildSnapshot({ projects: [makeProject({ id: "p1", observationTexts: [normalizeName(obs)] })] });
    const { plan } = run([{ [ID_HEADER]: "p1", "Nova Observação": obs }], snap);
    expect(plan.updates).toHaveLength(0);
  });

  it("nova observação inédita é adicionada", () => {
    const snap = buildSnapshot({ projects: [makeProject({ id: "p1" })] });
    const { plan } = run([{ [ID_HEADER]: "p1", "Nova Observação": "observação nova" }], snap);
    expect(plan.updates[0].observationToAdd).toBe("observação nova");
  });

  it("mestre não encontrado: pula só o campo, registra pendência, aplica o resto", () => {
    const snap = buildSnapshot({ projects: [makeProject({ id: "p1" })] }); // sem sellers
    const { plan, report } = run([{ [ID_HEADER]: "p1", "Vendedor": "FULANO", "Telefone": "11988887777" }], snap);
    expect(plan.updates[0].data.sellerId).toBeUndefined();
    expect(plan.updates[0].data.engineerPhone).toBe("11988887777");
    expect(report.sellersNotFound).toContain("FULANO");
    expect(report.matched[0].pendingRefs).toEqual([{ field: "vendedor", valor: "FULANO" }]);
  });

  it("determinismo: reanalisar produz a mesma ordem (base do commit em lotes)", () => {
    const projects = [makeProject({ id: "a", code: "C-1" }), makeProject({ id: "b", code: "C-2", workName: "OBRA Y" })];
    const rows: Record<string, string>[] = [{ [ID_HEADER]: "a", "Vendedor": "L" }, { [ID_HEADER]: "b", "Telefone": "11" }];
    const snap1 = buildSnapshot({ projects });
    const snap2 = buildSnapshot({ projects });
    const o1 = run(rows, snap1).report.matched.map((m) => m.projectId);
    const o2 = run(rows, snap2).report.matched.map((m) => m.projectId);
    expect(o1).toEqual(o2);
  });
});
