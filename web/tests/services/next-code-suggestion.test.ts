// @vitest-environment node
// Sugestão do código final (server-side): só projetos com status ATUAL
// PROJETO_FINAL_ENVIADO participam. Banco em memória: a consulta é aplicada de
// verdade sobre as linhas, e histórico/auditoria são espiões que NÃO podem ser lidos.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { SessionUser } from "@/server/auth/session";
import type { UserRole } from "@/features/auth/lib/auth-types";
import { HttpError } from "@/server/auth/guards";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const h = vi.hoisted(() => {
  const state = { projects: [] as Record<string, any>[] };
  const matches = (row: Record<string, any>, where: Record<string, any> = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && "not" in v) return row[k] !== v.not;
      if (v && typeof v === "object" && "in" in v) return v.in.includes(row[k]);
      return row[k] === v;
    });
  const pick = (row: Record<string, any> | undefined, select?: Record<string, any>) =>
    !row ? null : !select ? { ...row } : Object.fromEntries(Object.keys(select).map((k) => [k, row[k]]));
  const prismaFake = {
    project: {
      findMany: vi.fn(async ({ where, select }: Record<string, any> = {}) =>
        state.projects.filter((r) => matches(r, where)).map((r) => pick(r, select)),
      ),
      findUnique: vi.fn(async ({ where, select }: Record<string, any>) => pick(state.projects.find((r) => matches(r, where)), select)),
      findFirst: vi.fn(async ({ where, select }: Record<string, any>) => pick(state.projects.find((r) => matches(r, where)), select)),
    },
    projectStatusHistory: { findMany: vi.fn(async () => []) },
    auditLog: { findMany: vi.fn(async () => []), findFirst: vi.fn(async () => null) },
    $transaction: vi.fn(async () => {
      throw new Error("transação não deveria abrir neste teste");
    }),
  };
  return { state, prismaFake };
});

vi.mock("@/lib/db/prisma", () => ({ prisma: h.prismaFake }));
vi.mock("@/lib/mail/mail-service", () => ({ sendProjectMovementEmail: vi.fn(), sendProjectCreatedEmail: vi.fn() }));

import { changeStatus, nextCodeSuggestion } from "@/server/services/projectService";

function makeUser(role: UserRole): SessionUser {
  return {
    id: `u-${role}`,
    username: role.toLowerCase(),
    name: `Usuário ${role}`,
    email: null,
    role,
    active: true,
    mustChangePassword: false,
    permissions: structuredClone(getDefaultPermissions(role)),
    lastLoginAt: null,
    sellerIds: role === "SELLER" ? ["s1"] : [],
  };
}
const ADMIN = makeUser("ADMIN");
const PROJECTS = makeUser("PROJECTS");

let seq = 0;
const p = (code: string, status: string): Row => ({ id: `p${++seq}`, code, status });
const setStatus = (code: string, status: string) => {
  h.state.projects.find((r) => r.code === code)!.status = status;
};
const suggest = (current = "CRE-NOV-0000") => nextCodeSuggestion(PROJECTS, current);

beforeEach(() => {
  vi.clearAllMocks();
  h.state.projects = [
    p("CRE-AAA-2158", "PROJETO_FINAL_ENVIADO"),
    p("CRE-BBB-2159", "PROJETO_FINAL_ENVIADO"),
    p("CRE-POM-2160", "PROJETO_FINAL_ENVIADO"),
  ];
});

describe("nextCodeSuggestion — consulta", () => {
  it("faz UMA consulta: Project.status = PROJETO_FINAL_ENVIADO, só o código", async () => {
    await suggest();
    expect(h.prismaFake.project.findMany).toHaveBeenCalledTimes(1);
    expect(h.prismaFake.project.findMany).toHaveBeenCalledWith({
      where: { status: "PROJETO_FINAL_ENVIADO" },
      select: { code: true },
    });
  });

  it("não lê ProjectStatusHistory nem AuditLog", async () => {
    await suggest();
    expect(h.prismaFake.projectStatusHistory.findMany).not.toHaveBeenCalled();
    expect(h.prismaFake.auditLog.findMany).not.toHaveBeenCalled();
    expect(h.prismaFake.auditLog.findFirst).not.toHaveBeenCalled();
  });

  it("mantém o contrato da API", async () => {
    expect(await suggest("CRE-TMP-0042")).toEqual({
      maxSuffix: 2160,
      nextSuffix: "2161",
      lastFinalCode: "CRE-POM-2160",
      currentDraftCode: "CRE-TMP-0042",
      suggestedFinalCode: "CRE-POM-2161",
    });
  });

  it("exige permissão de visualizar projetos", async () => {
    const noView = makeUser("PROJECTS");
    noView.permissions.projects.view = false;
    await expect(nextCodeSuggestion(noView, "X")).rejects.toBeInstanceOf(HttpError);
  });
});

describe("nextCodeSuggestion — regra (só status ATUAL PF ENVIADO)", () => {
  it("normal: 2158, 2159, 2160 → 2161", async () => {
    expect((await suggest()).suggestedFinalCode).toBe("CRE-POM-2161");
  });

  it("aprovação (desejado): 2160 vai para PROJETO APROVADO → 2160", async () => {
    setStatus("CRE-POM-2160", "PROJETO_APROVADO");
    const r = await suggest();
    expect(r.lastFinalCode).toBe("CRE-BBB-2159");
    expect(r.suggestedFinalCode).toBe("CRE-BBB-2160");
  });

  it("revisão (desejado): 2160 aprovado e 2159 em REVISÃO DE PF → 2159", async () => {
    setStatus("CRE-POM-2160", "PROJETO_APROVADO");
    setStatus("CRE-BBB-2159", "REVISAO_DE_PROJETO_FINAL");
    expect((await suggest()).suggestedFinalCode).toBe("CRE-AAA-2159");
  });

  it("regressão: 2199 regredido para AP ENVIADO; PF máximo 2160 → 2161 (não 2200)", async () => {
    h.state.projects.push(p("CRE-XXX-2199", "ANTE_PROJETO_ENVIADO"));
    expect((await suggest()).suggestedFinalCode).toBe("CRE-POM-2161");
  });

  it("histórico não interfere: projeto que já passou por PF com 3000 e hoje está em outro status", async () => {
    h.state.projects.push(p("CRE-HIS-3000", "ELABORAR_ANTE_PROJETO"));
    h.prismaFake.projectStatusHistory.findMany.mockResolvedValue([
      { projectId: "qualquer", toStatus: "PROJETO_FINAL_ENVIADO" },
    ] as never);
    expect((await suggest()).suggestedFinalCode).toBe("CRE-POM-2161");
  });

  it("PROJETO APROVADO com 3000 não interfere → 2161", async () => {
    h.state.projects.push(p("CRE-APR-3000", "PROJETO_APROVADO"));
    expect((await suggest()).suggestedFinalCode).toBe("CRE-POM-2161");
  });

  it("REVISÃO DE PF com 2500 não interfere → 2161", async () => {
    h.state.projects.push(p("CRE-REV-2500", "REVISAO_DE_PROJETO_FINAL"));
    expect((await suggest()).suggestedFinalCode).toBe("CRE-POM-2161");
  });

  it("nenhum outro status interfere (AP aprovado, Cadastro Inicial com 15111)", async () => {
    h.state.projects.push(p("CRE-TMP-9990", "ANTE_PROJETO_APROVADO"), p("CRE-BGP-15111", "CADASTRO_INICIAL"));
    expect((await suggest()).suggestedFinalCode).toBe("CRE-POM-2161");
  });

  it("inválidos em PF são ignorados: 21ZZ, 1864R1 → 2161", async () => {
    h.state.projects = [
      p("CRE-XXX-21ZZ", "PROJETO_FINAL_ENVIADO"),
      p("CRE-ABC-1864R1", "PROJETO_FINAL_ENVIADO"),
      p("CRE-AAA-2160", "PROJETO_FINAL_ENVIADO"),
    ];
    expect((await suggest()).suggestedFinalCode).toBe("CRE-AAA-2161");
  });

  it("só '-' + exatamente 4 dígitos entra: 15111, X9999 e 216 em PF são ignorados → 2161", async () => {
    h.state.projects = [
      p("CRE-AAA-2160", "PROJETO_FINAL_ENVIADO"),
      p("CRE-BBB-15111", "PROJETO_FINAL_ENVIADO"),
      p("CRE-CCC-X9999", "PROJETO_FINAL_ENVIADO"),
      p("CRE-DDD-216", "PROJETO_FINAL_ENVIADO"),
    ];
    const r = await suggest();
    expect(r.lastFinalCode).toBe("CRE-AAA-2160");
    expect(r.suggestedFinalCode).toBe("CRE-AAA-2161");
  });

  it("PF só com 15111, 21ZZ e 1864R1: fallback do código atual", async () => {
    h.state.projects = [
      p("CRE-AAA-15111", "PROJETO_FINAL_ENVIADO"),
      p("CRE-BBB-21ZZ", "PROJETO_FINAL_ENVIADO"),
      p("CRE-CCC-1864R1", "PROJETO_FINAL_ENVIADO"),
    ];
    const r = await suggest("CRE-TMP-0042");
    expect(r.lastFinalCode).toBeNull();
    expect(r.suggestedFinalCode).toBe("CRE-TMP-0042");
  });

  it("sem código válido em PF: usa o código atual, sem sequência de outros status", async () => {
    h.state.projects = [
      p("CRE-XXX-21ZZ", "PROJETO_FINAL_ENVIADO"),
      p("CRE-ABC-1864R1", "PROJETO_FINAL_ENVIADO"),
      p("CRE-APR-3000", "PROJETO_APROVADO"),
      p("CRE-BGP-15111", "CADASTRO_INICIAL"),
    ];
    expect(await suggest("CRE-TMP-0042")).toEqual({
      maxSuffix: 0,
      nextSuffix: "",
      lastFinalCode: null,
      currentDraftCode: "CRE-TMP-0042",
      suggestedFinalCode: "CRE-TMP-0042",
    });
  });

  it("prefixos diferentes: AAA-AAA-2159 e BBB-BBB-2160 → sufixo 2161", async () => {
    h.state.projects = [p("AAA-AAA-2159", "PROJETO_FINAL_ENVIADO"), p("BBB-BBB-2160", "PROJETO_FINAL_ENVIADO")];
    expect((await suggest()).suggestedFinalCode).toBe("BBB-BBB-2161");
  });

  it("projeto aprovado que volta para PF ENVIADO volta a contar → 2161", async () => {
    setStatus("CRE-POM-2160", "PROJETO_APROVADO");
    expect((await suggest()).suggestedFinalCode).toBe("CRE-BBB-2160");
    setStatus("CRE-POM-2160", "PROJETO_FINAL_ENVIADO");
    expect((await suggest()).suggestedFinalCode).toBe("CRE-POM-2161");
  });
});

describe("duplicidade (validação existente inalterada)", () => {
  it("código completo já usado → 409 antes de abrir a transação", async () => {
    setStatus("CRE-POM-2160", "PROJETO_APROVADO"); // a sugestão agora repete 2160...
    h.state.projects.push({ ...p("CRE-NOV-0001", "ANTE_PROJETO_APROVADO"), projectReceived: true });
    const moving = h.state.projects.at(-1)!;
    const err = await changeStatus(ADMIN, moving.id, "PROJETO FINAL ENVIADO", {
      source: "kanban",
      finalCode: "CRE-POM-2160", // ...mas o código completo existe: 409
    }).catch((e) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(409);
    expect(h.prismaFake.$transaction).not.toHaveBeenCalled();
  });
});
