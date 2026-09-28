import "server-only";
import Stripe from "stripe";

/**
 * The ONLY place where the Stripe SDK is instantiated.
 * Lazy so that importing modules at build time does not require the secret key.
 */
let client: Stripe | undefined;

export function getStripeClient(): Stripe {
  if (client) return client;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  if (process.env.APP_ENV !== "production" && secretKey.startsWith("sk_live_")) {
    throw new Error("Refusing to use a live Stripe key outside production");
  }
  const apiVersion = process.env.STRIPE_API_VERSION || undefined;
  client = new Stripe(secretKey, {
    ...(apiVersion ? { apiVersion: apiVersion as Stripe.StripeConfig["apiVersion"] } : {}),
    appInfo: { name: "Ripay", url: process.env.APP_URL },
    maxNetworkRetries: 2,
    telemetry: false,
  });
  return client;
}

export type { Stripe };
