import { configLogger } from "./logger";
import { configName } from "./name";
import { configServerWeb } from "./server/web";

export const config = {
  name: configName,
  logger: configLogger,
  server: { web: configServerWeb },
};
