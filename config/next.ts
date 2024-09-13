import { loadFromEnvIfSet } from "../util/config";

export const configNext = {
  enabled: await loadFromEnvIfSet("NEXT_ENABLED", true),
  dev: await loadFromEnvIfSet("NEXT_DEV", false),
};
