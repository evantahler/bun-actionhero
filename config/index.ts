import { configLogger } from "./logger";
import { configServerWeb } from "./server/web";

export const config = {
  logger: configLogger,
  server: { web: configServerWeb },
};
