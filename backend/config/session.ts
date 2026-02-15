import { loadFromEnvIfSet } from "../util/config";

export const configSession = {
  ttl: await loadFromEnvIfSet("SESSION_TTL", 60 * 60 * 24), // one day, in seconds
  cookieName: await loadFromEnvIfSet("SESSION_COOKIE_NAME", "__session"),
};
