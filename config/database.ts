import { loadFromEnvIfSet } from "../util/config";

export const configDatabase = {
  connectionString: await loadFromEnvIfSet("BUN_DB_CONNECTION_STRING", "x"),
  autoMigrate: await loadFromEnvIfSet("BUN_DB_AUTO_MIGRATE", true),
};
