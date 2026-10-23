import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { __kabrunRedis?: Redis };

/** Redis is used for cache, locks, rate limiting and (later) queues. Never for money state. */
export function getRedis(): Redis {
  if (!globalForRedis.__kabrunRedis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is not configured");
    globalForRedis.__kabrunRedis = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
  }
  return globalForRedis.__kabrunRedis;
}
