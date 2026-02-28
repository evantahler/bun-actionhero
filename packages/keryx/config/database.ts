import { loadFromEnvIfSet } from "../util/config";

export const configDatabase = {
  connectionString: await loadFromEnvIfSet("DATABASE_URL", "x"),
  autoMigrate: await loadFromEnvIfSet("DATABASE_AUTO_MIGRATE", true),
  pool: {
    max: await loadFromEnvIfSet("DATABASE_POOL_MAX", 10),
    min: await loadFromEnvIfSet("DATABASE_POOL_MIN", 0),
    idleTimeoutMillis: await loadFromEnvIfSet(
      "DATABASE_POOL_IDLE_TIMEOUT",
      10000,
    ),
    connectionTimeoutMillis: await loadFromEnvIfSet(
      "DATABASE_POOL_CONNECT_TIMEOUT",
      0,
    ),
    allowExitOnIdle: await loadFromEnvIfSet(
      "DATABASE_POOL_EXIT_ON_IDLE",
      false,
    ),
  },
};
