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
