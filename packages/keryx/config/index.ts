import { configActions } from "./actions";
import { configChannels } from "./channels";
import { configDatabase } from "./database";
import { configLogger } from "./logger";
import { configProcess } from "./process";
import { configRateLimit } from "./rateLimit";
import { configRedis } from "./redis";
import { configServerCli } from "./server/cli";
import { configServerMcp } from "./server/mcp";
import { configServerWeb } from "./server/web";
import { configSession } from "./session";
import { configTasks } from "./tasks";

export const config = {
  actions: configActions,
  channels: configChannels,
  process: configProcess,
  logger: configLogger,
  database: configDatabase,
  redis: configRedis,
  rateLimit: configRateLimit,
  session: configSession,
  server: { cli: configServerCli, web: configServerWeb, mcp: configServerMcp },
  tasks: configTasks,
};

export type KeryxConfig = typeof config;
