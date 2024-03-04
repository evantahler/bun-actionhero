import type { LogLevel } from "../logger";
import { loadFromEnvIfSet } from "../util/config";

export const configLogger = {
  level: loadFromEnvIfSet<LogLevel>("logger.level", "info"),
  includeTimestamps: loadFromEnvIfSet("logger.includeTimestamps", true),
  colorize: loadFromEnvIfSet("logger.colorize", true),
};
