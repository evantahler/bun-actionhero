import { loadFromEnvIfSet } from "../util/config";

export const configDatabase = {
  connectionString: await loadFromEnvIfSet("db.connectionString", "x"),
  autoMigrate: await loadFromEnvIfSet("db.autoMigrate", true),
};

console.log({ configDatabase });
