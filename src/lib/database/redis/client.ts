import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { __hypeiRedis?: Redis };

/** Redis is used for cache, locks, rate limiting and (later) queues. Never for money state. */
export function getRedis(): Redis {
  if (!globalForRedis.__hypeiRedis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is not configured");
    globalForRedis.__hypeiRedis = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
  }
  return globalForRedis.__hypeiRedis;
}
