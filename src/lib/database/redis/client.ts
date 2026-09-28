import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { __ripayRedis?: Redis };

/** Redis is used for cache, locks, rate limiting and (later) queues. Never for money state. */
export function getRedis(): Redis {
  if (!globalForRedis.__ripayRedis) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is not configured");
    globalForRedis.__ripayRedis = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: false });
  }
  return globalForRedis.__ripayRedis;
}
