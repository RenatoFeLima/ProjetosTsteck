// @vitest-environment node
// GET /api/auth/me — a rota que virou 500 genérico durante a queda do MySQL
// (não tinha try/catch). Contrato: ausência de sessão NÃO é erro.
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  getSessionImpl: null as unknown as () => Promise<unknown>,
}));

vi.mock("@/server/auth/session", () => ({
  getSession: vi.fn(async () => state.getSessionImpl()),
}));

import { GET } from "@/app/api/auth/me/route";

function prismaUnavailableError() {
  const err = new Error("Can't reach database server at `db.exemplo.invalid:3306`");
  err.name = "PrismaClientInitializationError";
  return err;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.getSessionImpl = async () => null;
});

describe("GET /api/auth/me", () => {
  it("sem sessão → 200 { user: null } (contrato preservado, NÃO é 401)", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ user: null });
  });

  it("sessão válida → 200 com o usuário", async () => {
    state.getSessionImpl = async () => ({ id: "u1", username: "usuarioteste", name: "Usuário Teste" });
    const res = await GET();
    const body = (await res.json()) as { user: { id: string } };

    expect(res.status).toBe(200);
    expect(body.user.id).toBe("u1");
  });

  it("banco indisponível → 503 SERVICE_UNAVAILABLE com requestId", async () => {
    state.getSessionImpl = async () => {
      throw prismaUnavailableError();
    };
    const res = await GET();
    const raw = await res.clone().text();
    const body = JSON.parse(raw) as Record<string, unknown>;

    expect(res.status).toBe(503);
    expect(body.code).toBe("SERVICE_UNAVAILABLE");
    expect(body.requestId).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(res.headers.get("X-Request-ID")).toBe(body.requestId);
    // Nenhum detalhe técnico atravessa.
    expect(raw).not.toContain("exemplo.invalid");
    expect(raw).not.toContain("Prisma");
  });

  it("erro inesperado → 500 INTERNAL_ERROR (não 503)", async () => {
    state.getSessionImpl = async () => {
      throw new TypeError("bug de verdade");
    };
    const res = await GET();
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.requestId).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
  });
});
