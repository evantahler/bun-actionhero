import { loadFromEnvIfSet } from "bun-actionhero";

/**
 * User config overrides. These are deep-merged onto the framework defaults.
 * Only specify values you want to override.
 */
export const config = {
  process: {
    name: await loadFromEnvIfSet("PROCESS_NAME", "bun-actionhero-example"),
  },
  database: {
    connectionString: await loadFromEnvIfSet("DATABASE_URL", "x"),
  },
};
