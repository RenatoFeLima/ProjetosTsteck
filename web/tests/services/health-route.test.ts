// @vitest-environment node
// GET /api/health — endpoint público de monitoramento. Deve ser mínimo e
// jamais revelar detalhe de infraestrutura.
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queryImpl: null as unknown as () => Promise<unknown>,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: { $queryRaw: vi.fn(async () => state.queryImpl()) },
}));

import { GET } from "@/app/api/health/route";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.queryImpl = async () => [{ "1": 1 }];
});

describe("GET /api/health", () => {
  it("banco OK → 200 { status: 'ok' }", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });

  it("banco indisponível → 503 { status: 'degraded' }", async () => {
    state.queryImpl = async () => {
      const err = new Error("Can't reach database server at `db.exemplo.invalid:3306`");
      err.name = "PrismaClientInitializationError";
      throw err;
    };
    const res = await GET();
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ status: "degraded" });
  });

  it("responde com Cache-Control: no-store nos dois casos", async () => {
    expect((await GET()).headers.get("Cache-Control")).toBe("no-store");

    state.queryImpl = async () => {
      throw new Error("down");
    };
    expect((await GET()).headers.get("Cache-Control")).toBe("no-store");
  });

  it("NÃO expõe metadados internos", async () => {
    state.queryImpl = async () => {
      throw new Error("Can't reach database server at `db.exemplo.invalid:3306`");
    };
    const raw = await (await GET()).text();

    for (const forbidden of [
      "exemplo.invalid",
      "db.exemplo",
      "3306",
      "Prisma",
      "prisma",
      "mysql",
      "DATABASE_URL",
      "tsteck_projetos",
      "version",
    ]) {
      expect(raw).not.toContain(forbidden);
    }
    // O corpo é só o status — nada além disso.
    expect(Object.keys(JSON.parse(raw))).toEqual(["status"]);
  });
});
