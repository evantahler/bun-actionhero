import { loadFromEnvIfSet } from "../util/config";

export const configRateLimit = {
  enabled: await loadFromEnvIfSet("RATE_LIMIT_ENABLED", true),
  windowMs: await loadFromEnvIfSet("RATE_LIMIT_WINDOW_MS", 60_000), // 60 seconds
  unauthenticatedLimit: await loadFromEnvIfSet("RATE_LIMIT_UNAUTH_LIMIT", 20),
  authenticatedLimit: await loadFromEnvIfSet("RATE_LIMIT_AUTH_LIMIT", 200),
  keyPrefix: await loadFromEnvIfSet("RATE_LIMIT_KEY_PREFIX", "ratelimit"),
};
