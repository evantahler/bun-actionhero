import { configLogger } from "./logger";
import { configProcess } from "./process";
import { configServerWeb } from "./server/web";

export const config = {
  process: configProcess,
  logger: configLogger,
  server: { web: configServerWeb },
};
