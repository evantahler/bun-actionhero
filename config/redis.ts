import { loadFromEnvIfSet } from "../util/config";

export const configRedis = {
  connectionString: await loadFromEnvIfSet(
    "BUN_REDIS_CONNECTION_STRING",
    "redis:://localhost:6379/0",
  ),
};
