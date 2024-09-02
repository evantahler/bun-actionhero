import { loadFromEnvIfSet } from "../util/config";

export const configNext = {
  enabled: await loadFromEnvIfSet("BUN_NEXT_ENABLED", true),
  dev: await loadFromEnvIfSet("BUN_NEXT_DEV", false),
};
