import { loadFromEnvIfSet } from "../util/config";

export const configSession = {
  ttl: await loadFromEnvIfSet("session.ttl", 1000 * 60 * 60 * 24), // one day, in seconds
};
