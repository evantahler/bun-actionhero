import { configLogger } from "./logger";
import { configProcess } from "./process";
import { configServerWeb } from "./server/web";
import { configDatabase } from "./database";
import { configRedis } from "./redis";
import { configSession } from "./session";
import { configTasks } from "./tasks";

export const config = {
  process: configProcess,
  logger: configLogger,
  database: configDatabase,
  redis: configRedis,
  session: configSession,
  server: { web: configServerWeb },
  tasks: configTasks,
};
