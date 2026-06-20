import { describe, expect, it, beforeEach } from "vitest";
import {
  limitLogin,
  buildLoginIdentifier,
  loginRateLimitMode,
  __resetMemoryRateLimit,
  LOGIN_MAX,
  LOGIN_WINDOW_MS,
} from "@/lib/rate-limit";

// Sem UPSTASH_REDIS_REST_URL/_TOKEN no ambiente de teste, o módulo cai no
// fallback EM MEMÓRIA — é exatamente o caminho que queremos exercitar aqui.

beforeEach(() => {
  __resetMemoryRateLimit();
});

describe("limitLogin (fallback em memória)", () => {
  it("sinaliza modo 'memory' quando não há env do Upstash", () => {
    expect(loginRateLimitMode()).toBe("memory");
  });

  it("permite até LOGIN_MAX (5) tentativas na janela", async () => {
    const id = buildLoginIdentifier("1.1.1.1", "renato");
    for (let i = 0; i < LOGIN_MAX; i++) {
      const r = await limitLogin(id);
      expect(r.success).toBe(true);
    }
  });

  it("a 6ª tentativa é bloqueada (success=false)", async () => {
    const id = buildLoginIdentifier("1.1.1.1", "renato");
    for (let i = 0; i < LOGIN_MAX; i++) await limitLogin(id);
    const sixth = await limitLogin(id);
    expect(sixth.success).toBe(false);
    expect(sixth.remaining).toBe(0);
    expect(sixth.limit).toBe(LOGIN_MAX);
  });

  it("expõe reset no futuro (base do Retry-After)", async () => {
    const id = buildLoginIdentifier("1.1.1.1", "renato");
    for (let i = 0; i < LOGIN_MAX; i++) await limitLogin(id);
    const blocked = await limitLogin(id);
    const retryAfterSec = Math.ceil((blocked.reset - Date.now()) / 1000);
    expect(blocked.reset).toBeGreaterThan(Date.now());
    expect(retryAfterSec).toBeGreaterThan(0);
    expect(retryAfterSec).toBeLessThanOrEqual(Math.ceil(LOGIN_WINDOW_MS / 1000));
  });

  it("identificadores distintos têm contadores independentes", async () => {
    const a = buildLoginIdentifier("1.1.1.1", "renato");
    const b = buildLoginIdentifier("2.2.2.2", "renato");
    for (let i = 0; i < LOGIN_MAX; i++) await limitLogin(a);
    expect((await limitLogin(a)).success).toBe(false); // 'a' estourou
    expect((await limitLogin(b)).success).toBe(true); // 'b' intacto
  });

  describe("buildLoginIdentifier — normalização do username", () => {
    it("trim + lowercase: variações de caixa caem no MESMO bucket", async () => {
      // 'Renato', ' renato ' e 'RENATO' devem compartilhar o contador, senão
      // um atacante burlaria o limite variando a caixa.
      const variants = ["Renato", " renato ", "RENATO", "rEnAtO"];
      // 5 tentativas distribuídas entre as variações = 5 hits no mesmo bucket.
      for (let i = 0; i < LOGIN_MAX; i++) {
        const r = await limitLogin(buildLoginIdentifier("9.9.9.9", variants[i % variants.length]));
        expect(r.success).toBe(true);
      }
      // A 6ª (qualquer variação) já bate no limite.
      const blocked = await limitLogin(buildLoginIdentifier("9.9.9.9", "Renato"));
      expect(blocked.success).toBe(false);
    });

    it("IP vazio normaliza para 'anonymous'", () => {
      expect(buildLoginIdentifier("", "x")).toBe("anonymous:x");
      expect(buildLoginIdentifier("   ", "x")).toBe("anonymous:x");
    });
  });
});
