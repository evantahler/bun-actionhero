import { loadFromEnvIfSet } from "../util/config";

export const configNext = {
  enabled: await loadFromEnvIfSet("next.enabled", true),
  dev: await loadFromEnvIfSet("next.dev", true),
  quiet: await loadFromEnvIfSet("next.quiet", false),
};
