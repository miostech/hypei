import type Redis from "ioredis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

export interface RateLimiter {
  consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

/** Fixed-window limiter on Redis (INCR + EXPIRE). */
export class RedisRateLimiter implements RateLimiter {
  constructor(private readonly redis: Redis) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const redisKey = `ratelimit:${key}`;
    const [[, count], [, ttl]] = (await this.redis.multi().incr(redisKey).ttl(redisKey).exec()) as [[null, number], [null, number]];
    if (ttl < 0) await this.redis.expire(redisKey, windowSeconds);
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetSeconds: ttl < 0 ? windowSeconds : ttl };
  }
}

/**
 * Tenta o limitador compartilhado e cai para o de memória quando ele falha.
 *
 * Existe porque o contrário era pior: com o Redis fora do ar, o `consume` rejeitava e o
 * comprador recebia erro genérico ao tentar pagar — Redis caído virava checkout caído. O
 * fallback antigo só cobria `REDIS_URL` ausente, que é o caso que nunca acontece em produção.
 *
 * Degrada aberto, de propósito: durante a falha o limite fica mais fraco, e o contador da
 * memória começa do zero. É prejuízo aceitável; recusar toda venda enquanto o Redis não
 * volta não é. Cada falha é registrada porque rate limit degradado em silêncio é exatamente
 * como alguém descobre um cupom por força bruta sem ninguém perceber.
 */
export class ResilientRateLimiter implements RateLimiter {
  constructor(
    private readonly primary: RateLimiter,
    private readonly fallback: RateLimiter,
    private readonly onError: (error: unknown) => void = () => {},
  ) {}

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    try {
      return await this.primary.consume(key, limit, windowSeconds);
    } catch (error) {
      this.onError(error);
      return this.fallback.consume(key, limit, windowSeconds);
    }
  }
}

/** Used in tests / when Redis is unavailable. Per-process only. */
export class InMemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  async consume(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return { allowed: true, remaining: limit - 1, resetSeconds: windowSeconds };
    }
    entry.count++;
    return { allowed: entry.count <= limit, remaining: Math.max(0, limit - entry.count), resetSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
}
