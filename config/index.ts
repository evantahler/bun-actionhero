import { configLogger } from "./logger";
import { configProcess } from "./process";
import { configServerWeb } from "./server/web";
import { configDatabase } from "./database";

export const config = {
  process: configProcess,
  logger: configLogger,
  database: configDatabase,
  server: { web: configServerWeb },
};
