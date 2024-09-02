import { loadFromEnvIfSet } from "../util/config";

export const configSession = {
  ttl: await loadFromEnvIfSet("BUN_SESSION_TTL", 1000 * 60 * 60 * 24), // one day, in seconds
  cookieName: await loadFromEnvIfSet("BUN_SESSION_COOKIE_NAME", "__session"),
};
