// @vitest-environment node
// Rota do relatório PDF: valida permissão (403) e geração (200 application/pdf).
// Guards/CSRF são mockados; a barreira de permissão roda antes de gerar o PDF.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultPermissions } from "@/features/auth/lib/permissions";
import type { SessionUser } from "@/server/auth/session";
import type { UserRole } from "@/features/auth/lib/auth-types";

const guardsMock = vi.hoisted(() => ({ currentUser: null as SessionUser | null }));

vi.mock("@/server/auth/csrf", () => ({ requireSameOrigin: vi.fn() }));
vi.mock("@/server/auth/session", async (orig) => {
  const actual = await orig<typeof import("@/server/auth/session")>();
  return { ...actual, getSession: vi.fn(async () => guardsMock.currentUser) };
});

import { POST } from "@/app/api/projects/analytics/report/route";

function makeUser(role: UserRole, exportKpis: boolean): SessionUser {
  const permissions = structuredClone(getDefaultPermissions(role));
  permissions.kpis.export = exportKpis;
  permissions.kpis.view = true;
  return {
    id: "u1",
    username: "user",
    name: "Usuário Teste",
    role,
    permissions,
  } as SessionUser;
}

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/projects/analytics/report", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", origin: "http://localhost", host: "localhost" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const samplePayload = {
  meta: { periodo: "Todos os períodos", emitidoEm: "2026-07-08T10:00:00Z", filtros: [], projetosConsiderados: 1 },
  producaoPeriodo: [{ label: "Ante-projetos", value: "1" }],
  carteiraAtual: [],
  riscoOperacional: [],
  eficienciaSla: [],
  insights: [],
  gargalos: { permanenciaMedia: "N/D", concentracaoAtual: "N/D", semMovimentacao: "0", urgentesSemAvancar: "0", acaoRecomendada: "" },
  revisoes: [],
  projetosAtencao: { totalItens: 0, rows: [] },
};

describe("POST /api/projects/analytics/report", () => {
  beforeEach(() => {
    guardsMock.currentUser = null;
  });

  it("retorna 403 para usuário sem permissão kpis.export", async () => {
    guardsMock.currentUser = makeUser("SELLER", false);
    const res = await POST(makeRequest(samplePayload));
    expect(res.status).toBe(403);
  });

  it("retorna 401 quando não autenticado", async () => {
    guardsMock.currentUser = null;
    const res = await POST(makeRequest(samplePayload));
    expect(res.status).toBe(401);
  });

  it("gera PDF (200, application/pdf) para usuário com permissão", async () => {
    guardsMock.currentUser = makeUser("PROJECTS", true);
    const res = await POST(makeRequest(samplePayload));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("ADMIN sempre pode exportar (mesmo sem flag explícita)", async () => {
    guardsMock.currentUser = makeUser("ADMIN", false);
    const res = await POST(makeRequest(samplePayload));
    expect(res.status).toBe(200);
  });
});
