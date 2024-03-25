import { loadFromEnvIfSet } from "../util/config";

export const configRedis = {
  connectionString: await loadFromEnvIfSet("redis.connectionString", "x"),
};
