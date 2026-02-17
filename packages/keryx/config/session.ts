import { loadFromEnvIfSet } from "../util/config";

export enum CookieSameSite {
  Strict = "Strict",
  Lax = "Lax",
  None = "None",
}

export const configSession = {
  ttl: await loadFromEnvIfSet("SESSION_TTL", 60 * 60 * 24), // one day, in seconds
  cookieName: await loadFromEnvIfSet("SESSION_COOKIE_NAME", "__session"),
  cookieHttpOnly: await loadFromEnvIfSet("SESSION_COOKIE_HTTP_ONLY", true),
  cookieSecure: await loadFromEnvIfSet("SESSION_COOKIE_SECURE", false),
  cookieSameSite: await loadFromEnvIfSet(
    "SESSION_COOKIE_SAME_SITE",
    CookieSameSite.Strict,
  ),
};
