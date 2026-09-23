// @vitest-environment node
// Contrato de erro e contagem do rate limit em POST /api/auth/login.
//
// O ponto central: falha de INFRAESTRUTURA (503) não pode consumir a quota de
// credencial inválida nem ser exibida como "senha incorreta" — foi exatamente
// isso que bloqueou um usuário legítimo durante a indisponibilidade do MySQL.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RateLimitResult } from "@/lib/rate-limit";

const ALLOWED: RateLimitResult = { success: true, limit: 60, remaining: 59, reset: 0 };

const state = vi.hoisted(() => ({
  ipResult: null as unknown,
  credPeek: null as unknown,
  credConsume: null as unknown,
  loginImpl: null as unknown as (u: string, p: string) => Promise<unknown>,
  consumeCalls: 0,
  loginCalls: 0,
}));

vi.mock("@/server/auth/csrf", () => ({ requireSameOrigin: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ setSessionCookie: vi.fn(async () => {}) }));

vi.mock("@/lib/rate-limit", () => ({
  limitLoginIp: vi.fn(async () => state.ipResult),
  peekLoginCredential: vi.fn(async () => state.credPeek),
  consumeLoginCredential: vi.fn(async () => {
    state.consumeCalls++;
    return state.credConsume;
  }),
  retryAfterSeconds: (r: RateLimitResult) => Math.max(0, Math.ceil((r.reset - Date.now()) / 1000)),
}));

vi.mock("@/server/services/authService", () => ({
  login: vi.fn(async (u: string, p: string) => {
    state.loginCalls++;
    return state.loginImpl(u, p);
  }),
}));

import { POST } from "@/app/api/auth/login/route";

/** Erro idêntico ao observado em produção durante a queda do MySQL. */
function prismaUnavailableError() {
  const err = new Error(
    "Invalid `prisma.user.findUnique()` invocation:\n\nCan't reach database server at `db.exemplo.invalid:3306`",
  );
  err.name = "PrismaClientInitializationError";
  return err;
}

function makeRequest(body: unknown, ip = "1.1.1.1") {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      origin: "http://localhost",
      "x-forwarded-for": ip,
    },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

const CREDS = { username: "UsuarioTeste", password: "senha" };

/** Nada técnico pode atravessar para o corpo da resposta. */
const FORBIDDEN_IN_BODY = [
  "Prisma",
  "prisma",
  "exemplo.invalid",
  "DATABASE_URL",
  "3306",
  "findUnique",
  "at async",
  "db.exemplo",
];

async function readBody(res: Response) {
  const raw = await res.clone().text();
  for (const forbidden of FORBIDDEN_IN_BODY) {
    expect(raw).not.toContain(forbidden);
  }
  return JSON.parse(raw) as Record<string, unknown>;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.ipResult = { ...ALLOWED };
  state.credPeek = { success: true, limit: 5, remaining: 5, reset: 0 };
  state.credConsume = { success: true, limit: 5, remaining: 4, reset: 0 };
  state.consumeCalls = 0;
  state.loginCalls = 0;
  state.loginImpl = async () => ({
    ok: true,
    user: { id: "u1", username: "usuarioteste", name: "Usuário Teste" },
    mustChangePassword: false,
  });
});

describe("login válido", () => {
  it("retorna 200 e NÃO consome a quota de credencial", async () => {
    const res = await POST(makeRequest(CREDS));
    expect(res.status).toBe(200);
    expect(state.consumeCalls).toBe(0);
  });
});

describe("credencial inválida", () => {
  beforeEach(() => {
    state.loginImpl = async () => ({
      ok: false,
      code: "INVALID_CREDENTIALS",
      error: "Usuário ou senha incorretos.",
    });
  });

  it("retorna 401 com código INVALID_CREDENTIALS", async () => {
    const res = await POST(makeRequest(CREDS));
    const body = await readBody(res);
    expect(res.status).toBe(401);
    expect(body.code).toBe("INVALID_CREDENTIALS");
    expect(body.error).toBe("INVALID_CREDENTIALS"); // alias legado preservado
    expect(body.message).toBe("Usuário ou senha incorretos.");
  });

  it("consome EXATAMENTE uma tentativa da quota de credencial", async () => {
    await POST(makeRequest(CREDS));
    expect(state.consumeCalls).toBe(1);
  });

  it("não expõe requestId nem retryAfterSeconds", async () => {
    const body = await readBody(await POST(makeRequest(CREDS)));
    expect(body.requestId).toBeUndefined();
    expect(body.retryAfterSeconds).toBeUndefined();
  });

  it("se o incremento estourar o limite (corrida), vira 429", async () => {
    state.credConsume = { success: false, limit: 5, remaining: 0, reset: Date.now() + 600_000 };
    const res = await POST(makeRequest(CREDS));
    const body = await readBody(res);
    expect(res.status).toBe(429);
    expect(body.code).toBe("RATE_LIMIT");
  });
});

describe("rate limit", () => {
  it("nível IP bloqueado → 429 sem tocar no banco", async () => {
    state.ipResult = { success: false, limit: 60, remaining: 0, reset: Date.now() + 120_000 };
    const res = await POST(makeRequest(CREDS));
    const body = await readBody(res);

    expect(res.status).toBe(429);
    expect(body.code).toBe("RATE_LIMIT");
    expect(state.loginCalls).toBe(0);
    expect(state.consumeCalls).toBe(0);
  });

  it("nível credencial bloqueado → 429 sem tocar no banco e sem consumir de novo", async () => {
    state.credPeek = { success: false, limit: 5, remaining: 0, reset: Date.now() + 600_000 };
    const res = await POST(makeRequest(CREDS));

    expect(res.status).toBe(429);
    expect(state.loginCalls).toBe(0);
    expect(state.consumeCalls).toBe(0);
  });

  it("Retry-After no header corresponde ao retryAfterSeconds do body", async () => {
    state.ipResult = { success: false, limit: 60, remaining: 0, reset: Date.now() + 420_000 };
    const res = await POST(makeRequest(CREDS));
    const body = await readBody(res);

    const header = Number(res.headers.get("Retry-After"));
    expect(header).toBe(body.retryAfterSeconds);
    expect(header).toBeGreaterThan(0);
    expect(header).toBeLessThanOrEqual(420);
  });
});

describe("banco indisponível", () => {
  beforeEach(() => {
    state.loginImpl = async () => {
      throw prismaUnavailableError();
    };
  });

  it("retorna 503 SERVICE_UNAVAILABLE (não 401, não 500)", async () => {
    const res = await POST(makeRequest(CREDS));
    const body = await readBody(res);

    expect(res.status).toBe(503);
    expect(body.code).toBe("SERVICE_UNAVAILABLE");
    expect(body.code).not.toBe("INVALID_CREDENTIALS");
  });

  it("NÃO consome a quota de credencial inválida", async () => {
    await POST(makeRequest(CREDS));
    expect(state.consumeCalls).toBe(0);
  });

  it("expõe requestId no body e no header X-Request-ID, iguais", async () => {
    const res = await POST(makeRequest(CREDS));
    const body = await readBody(res);

    expect(body.requestId).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(res.headers.get("X-Request-ID")).toBe(body.requestId);
  });

  it("o mesmo requestId aparece no log do servidor", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const body = await readBody(await POST(makeRequest(CREDS)));
    const logged = spy.mock.calls.flat().map(String).join(" ");
    expect(logged).toContain(String(body.requestId));
  });
});

describe("erro inesperado (bug real, não infraestrutura)", () => {
  it("retorna 500 INTERNAL_ERROR com requestId", async () => {
    state.loginImpl = async () => {
      throw new TypeError("cannot read property 'x' of undefined");
    };
    const res = await POST(makeRequest(CREDS));
    const body = await readBody(res);

    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL_ERROR");
    expect(body.requestId).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(state.consumeCalls).toBe(0);
  });
});

describe("validação de entrada", () => {
  it("campos ausentes → 400 VALIDATION_ERROR sem tocar no rate limit", async () => {
    const res = await POST(makeRequest({ username: 123 }));
    const body = await readBody(res);

    expect(res.status).toBe(400);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(state.consumeCalls).toBe(0);
    expect(state.loginCalls).toBe(0);
  });
});
