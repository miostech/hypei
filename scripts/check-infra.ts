import "dotenv/config";
import { MongoClient } from "mongodb";
import Redis from "ioredis";
import { createPrismaClient } from "../src/lib/database/postgres/client";
import { ensureMongoIndexes } from "../src/lib/database/mongo/collections";

/** Verifies that every backing service the app needs is reachable and configured. */
type Check = { name: string; run: () => Promise<string> };

const checks: Check[] = [
  {
    name: "PostgreSQL",
    run: async () => {
      const prisma = createPrismaClient(process.env.DATABASE_URL!);
      const [{ version }] = await prisma.$queryRaw<{ version: string }[]>`SELECT version()`;
      const policies = await prisma.settlementPolicy.count();
      await prisma.$disconnect();
      return `${version.split(" ").slice(0, 2).join(" ")} · ${policies} settlement policies`;
    },
  },
  {
    name: "MongoDB",
    run: async () => {
      const client = new MongoClient(process.env.MONGODB_URI!, { serverSelectionTimeoutMS: 5000 });
      await client.connect();
      const db = client.db(process.env.MONGODB_DB ?? "hypei");
      await ensureMongoIndexes(db);
      const collections = await db.listCollections().toArray();
      await client.close();
      return `${collections.length} collections with indexes`;
    },
  },
  {
    name: "Redis",
    run: async () => {
      const redis = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: 1, lazyConnect: true });
      await redis.connect();
      const pong = await redis.ping();
      redis.disconnect();
      return pong;
    },
  },
  {
    name: "Keycloak",
    run: async () => {
      const base = process.env.KEYCLOAK_INTERNAL_URL || process.env.KEYCLOAK_URL;
      const response = await fetch(`${base}/realms/${process.env.KEYCLOAK_REALM}/.well-known/openid-configuration`);
      if (!response.ok) throw new Error(`discovery returned ${response.status}`);
      const config = (await response.json()) as { issuer: string };
      return `realm reachable · issuer ${config.issuer}`;
    },
  },
  {
    name: "Payment provider",
    run: async () => {
      const provider = process.env.PAYMENT_PROVIDER ?? "mock";
      if (provider !== "stripe") return "mock (no real money movement)";
      if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY missing");
      if (process.env.STRIPE_SECRET_KEY.startsWith("sk_live_") && process.env.APP_ENV !== "production") {
        throw new Error("live key outside production");
      }
      return "stripe (test mode keys)";
    },
  },
];

async function main() {
  let failed = false;
  for (const check of checks) {
    try {
      const detail = await check.run();
      console.log(`✔ ${check.name.padEnd(18)} ${detail}`);
    } catch (error) {
      failed = true;
      console.error(`✖ ${check.name.padEnd(18)} ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (failed) process.exit(1);
}

void main();
