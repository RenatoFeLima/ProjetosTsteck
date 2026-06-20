// @vitest-environment node
// CSRF é lógica server-side. Rodamos em node (não jsdom) porque guards.ts puxa
// session.ts → prisma.ts, que se recusa a carregar quando `window` existe.
import { describe, expect, it } from "vitest";
import { requireSameOrigin } from "@/server/auth/csrf";
import { HttpError } from "@/server/auth/guards";

// Origem sempre permitida (independe de env): a de produção fica hardcoded em
// allowedOrigins(). Usamos ela para não acoplar os testes a VERCEL_URL etc.
const ALLOWED_ORIGIN = "https://projetos-tsteck.vercel.app";
const EXTERNAL_ORIGIN = "https://evil-attacker.com";

/** Mock mínimo de NextRequest: requireSameOrigin só lê `method` e `headers`. */
function makeReq(method: string, headers: Record<string, string> = {}) {
  return {
    method,
    headers: new Headers(headers),
  } as unknown as Parameters<typeof requireSameOrigin>[0];
}

describe("requireSameOrigin (proteção CSRF)", () => {
  it("GET passa sem qualquer header (método seguro)", () => {
    expect(() => requireSameOrigin(makeReq("GET"))).not.toThrow();
  });

  it("HEAD e OPTIONS também passam (métodos seguros)", () => {
    expect(() => requireSameOrigin(makeReq("HEAD"))).not.toThrow();
    expect(() => requireSameOrigin(makeReq("OPTIONS"))).not.toThrow();
  });

  it("POST sem Origin falha com 403/CSRF_INVALID", () => {
    try {
      requireSameOrigin(makeReq("POST", { "x-requested-with": "XMLHttpRequest" }));
      throw new Error("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(403);
      expect((e as HttpError).code).toBe("CSRF_INVALID");
    }
  });

  it("POST com Origin externo falha com 403/CSRF_INVALID", () => {
    const req = makeReq("POST", {
      origin: EXTERNAL_ORIGIN,
      "x-requested-with": "XMLHttpRequest",
    });
    expect(() => requireSameOrigin(req)).toThrowError(HttpError);
    try {
      requireSameOrigin(req);
    } catch (e) {
      expect((e as HttpError).status).toBe(403);
      expect((e as HttpError).code).toBe("CSRF_INVALID");
    }
  });

  it("POST com Origin permitido mas SEM X-Requested-With falha", () => {
    const req = makeReq("POST", { origin: ALLOWED_ORIGIN });
    try {
      requireSameOrigin(req);
      throw new Error("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(403);
      expect((e as HttpError).code).toBe("CSRF_INVALID");
    }
  });

  it("POST com Origin permitido + X-Requested-With passa", () => {
    const req = makeReq("POST", {
      origin: ALLOWED_ORIGIN,
      "x-requested-with": "XMLHttpRequest",
    });
    expect(() => requireSameOrigin(req)).not.toThrow();
  });

  it("PATCH e DELETE seguem a mesma regra (origem + header)", () => {
    for (const method of ["PATCH", "DELETE", "PUT"]) {
      const ok = makeReq(method, {
        origin: ALLOWED_ORIGIN,
        "x-requested-with": "XMLHttpRequest",
      });
      expect(() => requireSameOrigin(ok)).not.toThrow();

      const bad = makeReq(method, { origin: EXTERNAL_ORIGIN });
      expect(() => requireSameOrigin(bad)).toThrowError(HttpError);
    }
  });
});
