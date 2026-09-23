// @vitest-environment node
//
// REGRESSÃO DO INCIDENTE DE PRODUÇÃO (25/08/2026)
//
// O que aconteceu: o MySQL de produção ficou inacessível, o login passou a
// devolver 500, e cada tentativa durante a indisponibilidade CONSUMIA a quota
// de rate limit. Quando o banco voltou, o usuário legítimo já estava em
// 429 RATE_LIMIT sem nunca ter errado a senha.
//
// Este teste percorre a linha do tempo real e trava o comportamento correto:
// falha de infraestrutura NÃO pode gastar a quota de credencial inválida.
//
// Diferente dos demais testes de rota, aqui o rate limiter NÃO é mockado —
// usamos o limitador em memória de verdade, para exercitar a contagem.
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetMemoryRateLimit,
  peekLoginCredential,
  LOGIN_CRED_MAX,
} from "@/lib/rate-limit";

const state = vi.hoisted(() => ({
  databaseUp: true,
  passwordCorrect: false,
}));

vi.mock("@/server/auth/csrf", () => ({ requireSameOrigin: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ setSessionCookie: vi.fn(async () => {}) }));

vi.mock("@/server/services/authService", () => ({
  login: vi.fn(async () => {
    if (!state.databaseUp) {
      // Mesmo formato do erro registrado durante o incidente (host fictício).
      const err = new Error(
        "Invalid `prisma.user.findUnique()` invocation:\n\n" +
          "Can't reach database server at `db.exemplo.invalid:3306`",
      );
      err.name = "PrismaClientInitializationError";
      throw err;
    }
    if (state.passwordCorrect) {
      return { ok: true, user: { id: "u1" }, mustChangePassword: false };
    }
    return { ok: false, code: "INVALID_CREDENTIALS", error: "Usuário ou senha incorretos." };
  }),
}));

import { POST } from "@/app/api/auth/login/route";

const IP = "200.100.50.25";
const USERNAME = "UsuarioTeste";

function attempt() {
  const req = new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      origin: "http://localhost",
      "x-forwarded-for": IP,
    },
    body: JSON.stringify({ username: USERNAME, password: "qualquer" }),
  }) as unknown as import("next/server").NextRequest;
  return POST(req);
}

/** Quantas tentativas de credencial inválida já foram contabilizadas. */
async function consumedQuota(): Promise<number> {
  const peek = await peekLoginCredential(IP, USERNAME);
  return LOGIN_CRED_MAX - peek.remaining;
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  __resetMemoryRateLimit();
  state.databaseUp = true;
  state.passwordCorrect = false;
});

describe("linha do tempo do incidente real", () => {
  it("indisponibilidade do banco não gasta a quota de credencial", async () => {
    // 1-3. Banco no ar, o usuário erra a senha 2 vezes → quota = 2.
    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);
    expect(await consumedQuota()).toBe(2);

    // 4-6. O MySQL cai. Três tentativas, todas 503.
    state.databaseUp = false;
    for (let i = 0; i < 3; i++) {
      const res = await attempt();
      const body = (await res.json()) as Record<string, unknown>;
      expect(res.status).toBe(503);
      expect(body.code).toBe("SERVICE_UNAVAILABLE");
      // Jamais apresentar indisponibilidade como erro de senha.
      expect(body.code).not.toBe("INVALID_CREDENTIALS");
    }

    // 7. ⭐ O ponto do incidente: a quota continua em 2, não em 5.
    expect(await consumedQuota()).toBe(2);

    // 8-9. O banco volta e o usuário erra a senha de novo.
    state.databaseUp = true;
    expect((await attempt()).status).toBe(401);

    // 10. Só AGORA chega a 3.
    expect(await consumedQuota()).toBe(3);
  });

  it("com o banco fora, o usuário nunca é bloqueado por 429", async () => {
    state.databaseUp = false;
    // Dez tentativas durante a queda — no comportamento antigo isto bloqueava.
    for (let i = 0; i < 10; i++) {
      expect((await attempt()).status).toBe(503);
    }
    expect(await consumedQuota()).toBe(0);

    // Banco volta: o usuário ainda tem as 5 tentativas intactas.
    state.databaseUp = true;
    state.passwordCorrect = true;
    expect((await attempt()).status).toBe(200);
  });

  it("login válido após a recuperação não consome quota", async () => {
    expect((await attempt()).status).toBe(401);
    expect(await consumedQuota()).toBe(1);

    state.passwordCorrect = true;
    expect((await attempt()).status).toBe(200);
    expect(await consumedQuota()).toBe(1);
  });

  it("a proteção real continua valendo: 5 senhas erradas bloqueiam a 6ª", async () => {
    for (let i = 0; i < LOGIN_CRED_MAX; i++) {
      expect((await attempt()).status).toBe(401);
    }
    const blocked = await attempt();
    const body = (await blocked.json()) as Record<string, unknown>;

    expect(blocked.status).toBe(429);
    expect(body.code).toBe("RATE_LIMIT");
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    // Header e body derivam do MESMO cálculo.
    expect(Number(blocked.headers.get("Retry-After"))).toBe(body.retryAfterSeconds);
  });
});
