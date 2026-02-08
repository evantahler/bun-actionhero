import { configDatabase } from "./database";
import { configLogger } from "./logger";
import { configProcess } from "./process";
import { configRedis } from "./redis";
import { configServerMcp } from "./server/mcp";
import { configServerWeb } from "./server/web";
import { configSession } from "./session";
import { configTasks } from "./tasks";

export const config = {
  process: configProcess,
  logger: configLogger,
  database: configDatabase,
  redis: configRedis,
  session: configSession,
  server: { web: configServerWeb, mcp: configServerMcp },
  tasks: configTasks,
};
