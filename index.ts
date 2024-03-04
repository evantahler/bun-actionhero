import { config } from "./config";
import { Logger } from "./logger";

const logger = new Logger(
  config.logger.level,
  config.logger.colorize,
  config.logger.includeTimestamps,
);
const api = { logger, config };
logger.debug("api object", api);

logger.info("Hello via Bun!");
