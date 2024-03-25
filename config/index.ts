import { configLogger } from "./logger";
import { configProcess } from "./process";
import { configServerWeb } from "./server/web";
import { configDatabase } from "./database";
import { configRedis } from "./redis";

export const config = {
  process: configProcess,
  logger: configLogger,
  database: configDatabase,
  redis: configRedis,
  server: { web: configServerWeb },
};
