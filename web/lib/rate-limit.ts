// Rate limiting para endpoints sensíveis (ex.: login por força bruta).
//
// Usa Upstash Redis QUANDO configurado (UPSTASH_REDIS_REST_URL + _TOKEN) —
// correto em ambiente serverless/Vercel (estado compartilhado entre instâncias).
// Sem essas variáveis, cai para um limitador EM MEMÓRIA (por instância): não é
// distribuído (cada lambda tem seu próprio contador), mas garante que NUNCA
// derrubamos o login por falta de config. O modo em uso é sinalizado em log e
// exposto por `loginRateLimitMode()` para health-check/observabilidade.
//
// ⚠️ PRODUÇÃO (Vercel): configure UPSTASH_REDIS_REST_URL/_TOKEN. Sem isso, o
// limite é por instância e um atacante pode contornar distribuindo as tentativas
// entre lambdas — o fallback é mitigação, não a proteção completa.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch em ms quando a janela reseta. */
  reset: number;
};

export type RateLimitMode = "upstash" | "memory";

export const LOGIN_MAX = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

const hasUpstashEnv = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);

/** Limitador Upstash, criado só se as variáveis estiverem presentes. */
const upstashLogin = hasUpstashEnv
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(LOGIN_MAX, "15 m"),
      analytics: true,
      prefix: "tsteck:login",
    })
  : null;

/** Modo ativo do rate limit de login. Use em health-check/observabilidade. */
export function loginRateLimitMode(): RateLimitMode {
  return upstashLogin ? "upstash" : "memory";
}

// Sinaliza UMA vez, na inicialização do módulo, qual modo está ativo. Em
// produção sem Upstash, emite WARN (segurança degradada); com Upstash, info.
if (loginRateLimitMode() === "memory") {
  const msg =
    "[rate-limit] Login usando fallback EM MEMÓRIA (por instância). " +
    "Configure UPSTASH_REDIS_REST_URL/_TOKEN para rate limit distribuído.";
  if (process.env.NODE_ENV === "production") console.warn(msg);
  else console.info(msg);
} else {
  console.info("[rate-limit] Login usando Upstash Redis (distribuído).");
}

// ─── Fallback em memória (sliding window simplificado) ──────────────────────
// Guarda timestamps por identificador; expurga os fora da janela a cada chamada.
const memoryHits = new Map<string, number[]>();

function memoryLimit(identifier: string, now: number): RateLimitResult {
  const windowStart = now - LOGIN_WINDOW_MS;
  const hits = (memoryHits.get(identifier) ?? []).filter((t) => t > windowStart);

  if (hits.length >= LOGIN_MAX) {
    const oldest = hits[0];
    memoryHits.set(identifier, hits);
    return {
      success: false,
      limit: LOGIN_MAX,
      remaining: 0,
      reset: oldest + LOGIN_WINDOW_MS,
    };
  }

  hits.push(now);
  memoryHits.set(identifier, hits);

  // Evita crescimento ilimitado do Map em processos longos.
  if (memoryHits.size > 10_000) {
    for (const [key, ts] of memoryHits) {
      if (ts.every((t) => t <= windowStart)) memoryHits.delete(key);
    }
  }

  return {
    success: true,
    limit: LOGIN_MAX,
    remaining: LOGIN_MAX - hits.length,
    reset: now + LOGIN_WINDOW_MS,
  };
}

/** Limpa o estado em memória — APENAS para testes. */
export function __resetMemoryRateLimit(): void {
  memoryHits.clear();
}

/** Monta o identificador de rate limit do login normalizando o username
 *  (trim + lowercase), para que "Renato", "renato " e "RENATO" contem no MESMO
 *  bucket e um atacante não burle o limite variando a caixa. */
export function buildLoginIdentifier(ip: string, username: string): string {
  const normalizedIp = (ip || "anonymous").trim() || "anonymous";
  const normalizedUser = (username || "").trim().toLowerCase();
  return `${normalizedIp}:${normalizedUser}`;
}

/** Consome uma tentativa de login para o identificador. Prefira passar o
 *  resultado de `buildLoginIdentifier(ip, username)`. */
export async function limitLogin(identifier: string): Promise<RateLimitResult> {
  if (upstashLogin) {
    const { success, limit, remaining, reset } = await upstashLogin.limit(identifier);
    return { success, limit, remaining, reset };
  }
  // Date.now() é aceitável aqui (runtime de produção, não em workflow scripts).
  return memoryLimit(identifier, Date.now());
}
