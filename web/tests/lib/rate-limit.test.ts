// @vitest-environment node
// Rate limit do login em DOIS NÍVEIS.
//
// Sem UPSTASH_REDIS_REST_URL/_TOKEN no ambiente de teste, o módulo opera no
// fallback EM MEMÓRIA — é o caminho exercitado aqui. O caminho Upstash é
// coberto injetando limitadores falsos via __setUpstashLimitersForTest.
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  limitLoginIp,
  peekLoginCredential,
  consumeLoginCredential,
  buildIpIdentifier,
  buildCredentialIdentifier,
  loginRateLimitMode,
  retryAfterSeconds,
  __resetMemoryRateLimit,
  __setUpstashLimitersForTest,
  LOGIN_IP_MAX,
  LOGIN_CRED_MAX,
  LOGIN_CRED_WINDOW_MS,
  type LoginLimiters,
} from "@/lib/rate-limit";

beforeEach(() => {
  __resetMemoryRateLimit();
});

afterEach(() => {
  __setUpstashLimitersForTest(null);
  vi.restoreAllMocks();
});

describe("modo de operação", () => {
  it("sinaliza 'memory' quando não há env do Upstash", () => {
    expect(loginRateLimitMode()).toBe("memory");
  });
});

describe("identificadores (formato das chaves no Redis)", () => {
  it("nível 1 usa prefixo 'ip:'", () => {
    expect(buildIpIdentifier("1.1.1.1")).toBe("ip:1.1.1.1");
  });

  it("nível 2 usa prefixo 'cred:' e normaliza o username", () => {
    expect(buildCredentialIdentifier("1.1.1.1", " Renato ")).toBe("cred:1.1.1.1:renato");
    expect(buildCredentialIdentifier("1.1.1.1", "RENATO")).toBe("cred:1.1.1.1:renato");
  });

  it("IP vazio normaliza para 'anonymous'", () => {
    expect(buildIpIdentifier("")).toBe("ip:anonymous");
    expect(buildCredentialIdentifier("   ", "x")).toBe("cred:anonymous:x");
  });
});

describe("nível 1 — abuso por IP", () => {
  it(`permite ${LOGIN_IP_MAX} requisições e bloqueia a seguinte`, async () => {
    for (let i = 0; i < LOGIN_IP_MAX; i++) {
      expect((await limitLoginIp("1.1.1.1")).success).toBe(true);
    }
    const blocked = await limitLoginIp("1.1.1.1");
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.limit).toBe(LOGIN_IP_MAX);
  });

  it("consome SEM depender do banco (é chamado antes de qualquer query)", async () => {
    // O módulo não importa prisma; se importasse, este teste falharia ao rodar
    // sem banco. Serve como trava arquitetural.
    const mod = await import("@/lib/rate-limit");
    expect(Object.keys(mod)).toContain("limitLoginIp");
    expect((await limitLoginIp("9.9.9.9")).success).toBe(true);
  });

  it("IPs distintos têm contadores independentes", async () => {
    for (let i = 0; i < LOGIN_IP_MAX; i++) await limitLoginIp("1.1.1.1");
    expect((await limitLoginIp("1.1.1.1")).success).toBe(false);
    expect((await limitLoginIp("2.2.2.2")).success).toBe(true);
  });
});

describe("nível 2 — credencial inválida", () => {
  it("peek NÃO consome quota", async () => {
    for (let i = 0; i < 20; i++) {
      const peek = await peekLoginCredential("1.1.1.1", "renato");
      expect(peek.success).toBe(true);
      expect(peek.remaining).toBe(LOGIN_CRED_MAX);
    }
  });

  it(`consume libera ${LOGIN_CRED_MAX} tentativas e bloqueia a seguinte`, async () => {
    for (let i = 0; i < LOGIN_CRED_MAX; i++) {
      expect((await consumeLoginCredential("1.1.1.1", "renato")).success).toBe(true);
    }
    expect((await consumeLoginCredential("1.1.1.1", "renato")).success).toBe(false);
    expect((await peekLoginCredential("1.1.1.1", "renato")).success).toBe(false);
  });

  it("variações de caixa caem no MESMO bucket (não dá para burlar o limite)", async () => {
    const variants = ["Renato", " renato ", "RENATO", "rEnAtO"];
    for (let i = 0; i < LOGIN_CRED_MAX; i++) {
      const r = await consumeLoginCredential("9.9.9.9", variants[i % variants.length]);
      expect(r.success).toBe(true);
    }
    expect((await consumeLoginCredential("9.9.9.9", "Renato")).success).toBe(false);
  });

  it("usuários distintos no mesmo IP não se afetam", async () => {
    for (let i = 0; i < LOGIN_CRED_MAX; i++) await consumeLoginCredential("1.1.1.1", "renato");
    expect((await peekLoginCredential("1.1.1.1", "renato")).success).toBe(false);
    expect((await peekLoginCredential("1.1.1.1", "maria")).success).toBe(true);
  });

  it("tentativa durante o bloqueio NÃO renova a janela", async () => {
    for (let i = 0; i < LOGIN_CRED_MAX; i++) await consumeLoginCredential("1.1.1.1", "renato");
    const first = await consumeLoginCredential("1.1.1.1", "renato");
    await new Promise((r) => setTimeout(r, 15));
    const second = await consumeLoginCredential("1.1.1.1", "renato");
    expect(first.success).toBe(false);
    expect(second.success).toBe(false);
    // Mesmo `reset`: a segunda tentativa bloqueada não empurrou o prazo.
    expect(second.reset).toBe(first.reset);
  });

  it("os dois níveis são independentes entre si", async () => {
    for (let i = 0; i < LOGIN_CRED_MAX; i++) await consumeLoginCredential("1.1.1.1", "renato");
    expect((await peekLoginCredential("1.1.1.1", "renato")).success).toBe(false);
    // O nível de IP mal foi tocado.
    expect((await limitLoginIp("1.1.1.1")).success).toBe(true);
  });
});

describe("retryAfterSeconds", () => {
  it("converte o reset em segundos positivos, dentro da janela", async () => {
    for (let i = 0; i < LOGIN_CRED_MAX; i++) await consumeLoginCredential("1.1.1.1", "renato");
    const blocked = await consumeLoginCredential("1.1.1.1", "renato");
    const seconds = retryAfterSeconds(blocked);
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(Math.ceil(LOGIN_CRED_WINDOW_MS / 1000));
  });

  it("nunca retorna negativo para janela já expirada", () => {
    expect(retryAfterSeconds({ success: false, limit: 5, remaining: 0, reset: 0 })).toBe(0);
  });
});

describe("fallback quando o Upstash falha EM RUNTIME", () => {
  /** Limitador falso que sempre rejeita — simula Redis fora do ar. */
  function brokenLimiters(): LoginLimiters {
    const boom = () => Promise.reject(new Error("upstash down"));
    return {
      ip: { limit: boom, getRemaining: boom },
      credential: { limit: boom, getRemaining: boom },
    } as unknown as LoginLimiters;
  }

  it("não propaga o erro: cai para o limitador em memória", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    __setUpstashLimitersForTest(brokenLimiters());

    await expect(limitLoginIp("1.1.1.1")).resolves.toMatchObject({ success: true });
    await expect(peekLoginCredential("1.1.1.1", "renato")).resolves.toMatchObject({
      success: true,
    });
    await expect(consumeLoginCredential("1.1.1.1", "renato")).resolves.toMatchObject({
      success: true,
    });

    expect(spy).toHaveBeenCalled();
  });

  it("o fallback mantém proteção: continua bloqueando após o limite", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    __setUpstashLimitersForTest(brokenLimiters());

    for (let i = 0; i < LOGIN_CRED_MAX; i++) {
      expect((await consumeLoginCredential("1.1.1.1", "renato")).success).toBe(true);
    }
    expect((await consumeLoginCredential("1.1.1.1", "renato")).success).toBe(false);
  });

  it("NUNCA loga o token do Upstash", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    __setUpstashLimitersForTest(brokenLimiters());
    await limitLoginIp("1.1.1.1");

    const logged = spy.mock.calls.flat().map(String).join(" ");
    expect(logged).not.toMatch(/UPSTASH_REDIS_REST_TOKEN/);
    expect(logged.toLowerCase()).not.toContain("token");
  });
});
