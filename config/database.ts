import { loadFromEnvIfSet } from "../util/config";

export const configDatabase = {
  connectionString: await loadFromEnvIfSet("DATABASE_URL", "x"),
  autoMigrate: await loadFromEnvIfSet("DATABASE_AUTO_MIGRATE", true),
};
