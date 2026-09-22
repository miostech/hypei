import "server-only";
import { z } from "zod";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 chars"),
  DATA_HASH_SECRET: z.string().min(32, "DATA_HASH_SECRET must be at least 32 chars"),

  DATABASE_URL: z.string().min(1),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB: z.string().default("hypei"),
  REDIS_URL: z.string().min(1),

  KEYCLOAK_URL: z.string().url(),
  KEYCLOAK_INTERNAL_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  KEYCLOAK_REALM: z.string().default("hypei"),
  KEYCLOAK_CLIENT_ID: z.string().default("hypei-web"),
  KEYCLOAK_CLIENT_SECRET: z.string().min(1),

  PAYMENT_PROVIDER: z.enum(["stripe", "mock"]).default("mock"),
  STRIPE_SECRET_KEY: optionalString,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_CONNECT_CLIENT_ID: optionalString,
  STRIPE_API_VERSION: optionalString,
  MOCK_WEBHOOK_SECRET: z.string().default("mock-webhook-local-dev-secret"),
  MOCK_PROCESSOR_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(400),

  STORAGE_PROVIDER: z.enum(["s3", "r2", "minio", "none"]).default("none"),
  EMAIL_PROVIDER: z.enum(["console", "resend", "ses", "postmark"]).default("console"),
  EMAIL_FROM: z.string().default("Hypei <no-reply@hypei.local>"),
  QUEUE_DRIVER: z.enum(["memory", "bullmq", "redis-streams"]).default("memory"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const env = parsed.data;
  if (env.PAYMENT_PROVIDER === "stripe") {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("PAYMENT_PROVIDER=stripe requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET");
    }
    if (env.APP_ENV !== "production" && env.STRIPE_SECRET_KEY.startsWith("sk_live_")) {
      throw new Error("Live Stripe keys are not allowed outside production");
    }
  }
  cached = env;
  return env;
}
