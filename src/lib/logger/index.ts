import pino from "pino";
import { getRequestContext } from "./request-context";

/**
 * Structured JSON logger. Sensitive fields are redacted at the serializer level so
 * they can never reach log storage even if passed by mistake.
 */
const REDACT_PATHS = [
  "password",
  "*.password",
  "cvv",
  "*.cvv",
  "cvc",
  "*.cvc",
  "cardNumber",
  "*.cardNumber",
  "accessToken",
  "*.accessToken",
  "access_token",
  "*.access_token",
  "refresh_token",
  "*.refresh_token",
  "id_token",
  "*.id_token",
  "idToken",
  "*.idToken",
  "clientSecret",
  "*.clientSecret",
  "client_secret",
  "*.client_secret",
  "secret",
  "*.secret",
  "authorization",
  "*.authorization",
  "headers.cookie",
  "headers.authorization",
  "headers['stripe-signature']",
  "taxId",
  "*.taxId",
];

const baseLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "hypei-web", env: process.env.APP_ENV ?? "development" },
  redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
  timestamp: pino.stdTimeFunctions.isoTime,
  mixin() {
    return getRequestContext() ?? {};
  },
});

export const logger = baseLogger;

export function childLogger(bindings: Record<string, unknown>) {
  return baseLogger.child(bindings);
}
