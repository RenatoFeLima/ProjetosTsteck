// Rate limiting do login — DOIS NÍVEIS independentes.
//
// ┌─ Nível 1 — ABUSO POR IP ──────────────────────────────────────────────────┐
// │ chave  : tsteck:login:ip:<ip>                                             │
// │ limite : 60 requisições / 5 min                                           │
// │ consome: SEMPRE, antes de tocar o banco                                   │
// │ objetivo: barrar flood/força-bruta bruta. Continua funcionando mesmo com  │
// │           o MySQL fora. Um 429 aqui NÃO significa "senha errada".         │
// └───────────────────────────────────────────────────────────────────────────┘
//
// ┌─ Nível 2 — CREDENCIAL INVÁLIDA ───────────────────────────────────────────┐
// │ chave  : tsteck:login:cred:<ip>:<username-normalizado>                    │
// │ limite : 5 tentativas / 15 min                                            │
// │ consome: SOMENTE após o serviço COMPROVAR credencial inválida             │
// │ NÃO consome: login válido, banco indisponível, timeout, 500.              │
// └───────────────────────────────────────────────────────────────────────────┘
//
// ⚠️ CONCORRÊNCIA — LIMITAÇÃO CONHECIDA E ACEITA
// O nível 2 é verificado (`peek`) antes de autenticar e incrementado só depois.
// Não há reserva/refund atômico entre Redis e banco. Logo, requisições
// PARALELAS podem passar pelo peek ao mesmo tempo e conseguir algumas
// tentativas além do limite dentro de uma janela. O nível 1 (por IP) limita o
// tamanho desse excesso. NÃO prometemos garantia "exactly once" aqui.
//
// ⚠️ MODO DE OPERAÇÃO
// Com UPSTASH_REDIS_REST_URL/_TOKEN → limitador DISTRIBUÍDO (correto em
// serverless). Sem eles, ou se o Upstash falhar EM RUNTIME, caímos para um
// limitador EM MEMÓRIA. O fallback é PROTEÇÃO DEGRADADA: o estado é por
// instância/lambda, então o limite efetivo é multiplicado pelo número de
// instâncias ativas. Ele existe para o login não cair junto com o Redis —
// não é equivalente ao Upstash.

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

// ─── Parâmetros ─────────────────────────────────────────────────────────────
export const LOGIN_IP_MAX = 60;
export const LOGIN_IP_WINDOW_MS = 5 * 60 * 1000; // 5 minutos

export const LOGIN_CRED_MAX = 5;
export const LOGIN_CRED_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

const RATE_LIMIT_PREFIX = "tsteck:login";

// ─── Normalização das variáveis de ambiente ─────────────────────────────────
/** Remove espaços/newline nas pontas e aspas envolventes acidentais.
 *  Motivo: em produção o token do Upstash chegou com whitespace e o SDK
 *  emitia "The redis token contains whitespace or newline". O `.trim()` é
 *  DEFESA — não substitui corrigir o valor da variável no provedor. */
function cleanEnv(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}

// NUNCA logar estes valores.
const upstashUrl = cleanEnv(process.env.UPSTASH_REDIS_REST_URL);
const upstashToken = cleanEnv(process.env.UPSTASH_REDIS_REST_TOKEN);
const hasUpstashEnv = Boolean(upstashUrl && upstashToken);

// ─── Limitadores Upstash (criados só se as variáveis estiverem presentes) ───
export type LoginLimiters = { ip: Ratelimit; credential: Ratelimit } | null;

function buildUpstashLimiters(): LoginLimiters {
  if (!hasUpstashEnv) return null;
  const redis = new Redis({ url: upstashUrl, token: upstashToken });
  return {
    // Sem analytics: é o contador de maior volume e não queremos inflar as
    // escritas no Redis por causa de telemetria.
    ip: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(LOGIN_IP_MAX, "5 m"),
      analytics: false,
      prefix: RATE_LIMIT_PREFIX,
    }),
    credential: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(LOGIN_CRED_MAX, "15 m"),
      analytics: true,
      prefix: RATE_LIMIT_PREFIX,
    }),
  };
}

let limiters: LoginLimiters = buildUpstashLimiters();

/** Modo CONFIGURADO do rate limit. Use em health-check/observabilidade.
 *  Não reflete falha pontual do Upstash em runtime (essa cai no fallback). */
export function loginRateLimitMode(): RateLimitMode {
  return limiters ? "upstash" : "memory";
}

// Sinaliza UMA vez, na inicialização do módulo, qual modo está ativo.
if (loginRateLimitMode() === "memory") {
  const msg =
    "[rate-limit] Login usando fallback EM MEMÓRIA (por instância — proteção degradada). " +
    "Configure UPSTASH_REDIS_REST_URL/_TOKEN para rate limit distribuído.";
  if (process.env.NODE_ENV === "production") console.warn(msg);
  else console.info(msg);
} else {
  console.info("[rate-limit] Login usando Upstash Redis (distribuído).");
}

// ─── Fallback em memória (sliding window simplificado) ──────────────────────
// Guarda timestamps por chave; expurga os fora da janela a cada chamada.
const memoryHits = new Map<string, number[]>();

function memoryLimit(
  key: string,
  max: number,
  windowMs: number,
  now: number,
  consume: boolean,
): RateLimitResult {
  const windowStart = now - windowMs;
  const hits = (memoryHits.get(key) ?? []).filter((t) => t > windowStart);
  memoryHits.set(key, hits);

  if (hits.length >= max) {
    // Bloqueado: NÃO registra o hit, para não renovar a janela indefinidamente.
    return { success: false, limit: max, remaining: 0, reset: hits[0] + windowMs };
  }

  if (consume) hits.push(now);

  // Evita crescimento ilimitado do Map em processos longos.
  if (memoryHits.size > 10_000) {
    for (const [k, ts] of memoryHits) {
      if (ts.every((t) => t <= windowStart)) memoryHits.delete(k);
    }
  }

  return {
    success: true,
    limit: max,
    remaining: max - hits.length,
    reset: consume && hits.length > 0 ? hits[0] + windowMs : now + windowMs,
  };
}

/** Limpa o estado em memória — APENAS para testes. */
export function __resetMemoryRateLimit(): void {
  memoryHits.clear();
}

/** Injeta/limpa os limitadores Upstash — APENAS para testes (permite exercitar
 *  o caminho de falha em runtime sem um Redis de verdade). */
export function __setUpstashLimitersForTest(next: LoginLimiters): void {
  limiters = next;
}

// ─── Identificadores ────────────────────────────────────────────────────────
function normalizeIp(ip: string): string {
  return (ip || "anonymous").trim() || "anonymous";
}

/** Identificador do nível 1. Chave final: `tsteck:login:ip:<ip>:<janela>`. */
export function buildIpIdentifier(ip: string): string {
  return `ip:${normalizeIp(ip)}`;
}

/** Identificador do nível 2. O username é normalizado (trim + lowercase) para
 *  que "Renato", "renato " e "RENATO" caiam no MESMO bucket e um atacante não
 *  burle o limite variando a caixa.
 *  Chave final: `tsteck:login:cred:<ip>:<username>:<janela>`. */
export function buildCredentialIdentifier(ip: string, username: string): string {
  return `cred:${normalizeIp(ip)}:${(username || "").trim().toLowerCase()}`;
}

// ─── Execução com fallback em runtime ───────────────────────────────────────
async function runWithFallback(
  operation: (limiter: Ratelimit) => Promise<RateLimitResult>,
  pick: (l: NonNullable<LoginLimiters>) => Ratelimit,
  memory: () => RateLimitResult,
): Promise<RateLimitResult> {
  const active = limiters;
  if (!active) return memory();

  try {
    return await operation(pick(active));
  } catch (error) {
    // Redis fora do ar NÃO pode derrubar o login: degrada para memória.
    // O erro técnico fica só no log; o usuário não vê nada disso.
    console.error("[rate-limit] Upstash indisponível — usando fallback EM MEMÓRIA:", error);
    return memory();
  }
}

// ─── Nível 1 — abuso por IP (consome sempre) ────────────────────────────────
export async function limitLoginIp(ip: string): Promise<RateLimitResult> {
  const identifier = buildIpIdentifier(ip);
  return runWithFallback(
    async (limiter) => {
      const { success, limit, remaining, reset } = await limiter.limit(identifier);
      return { success, limit, remaining, reset };
    },
    (l) => l.ip,
    () => memoryLimit(identifier, LOGIN_IP_MAX, LOGIN_IP_WINDOW_MS, Date.now(), true),
  );
}

// ─── Nível 2 — credencial inválida ──────────────────────────────────────────
/** Verifica se o par IP+username JÁ está bloqueado, SEM consumir quota.
 *  Chamado antes de tocar o banco. */
export async function peekLoginCredential(ip: string, username: string): Promise<RateLimitResult> {
  const identifier = buildCredentialIdentifier(ip, username);
  return runWithFallback(
    async (limiter) => {
      const { remaining, reset, limit } = await limiter.getRemaining(identifier);
      return { success: remaining > 0, limit, remaining: Math.max(0, remaining), reset };
    },
    (l) => l.credential,
    () => memoryLimit(identifier, LOGIN_CRED_MAX, LOGIN_CRED_WINDOW_MS, Date.now(), false),
  );
}

/** Consome UMA tentativa do nível 2. Só pode ser chamado depois de o serviço
 *  comprovar INVALID_CREDENTIALS. O incremento em si é atômico no Redis
 *  (script Lua do Upstash) — o que não é atômico é o par peek+consume. */
export async function consumeLoginCredential(
  ip: string,
  username: string,
): Promise<RateLimitResult> {
  const identifier = buildCredentialIdentifier(ip, username);
  return runWithFallback(
    async (limiter) => {
      const { success, limit, remaining, reset } = await limiter.limit(identifier);
      return { success, limit, remaining, reset };
    },
    (l) => l.credential,
    () => memoryLimit(identifier, LOGIN_CRED_MAX, LOGIN_CRED_WINDOW_MS, Date.now(), true),
  );
}

/** Segundos até a janela liberar — base do `Retry-After`/`retryAfterSeconds`. */
export function retryAfterSeconds(result: RateLimitResult, now = Date.now()): number {
  return Math.max(0, Math.ceil((result.reset - now) / 1000));
}
