import { LogLevel, type LoggerStream } from "../classes/Logger";
import { loadFromEnvIfSet } from "../util/config";

export const configLogger = {
  level: await loadFromEnvIfSet<LogLevel>("LOG_LEVEL", LogLevel.info),
  includeTimestamps: await loadFromEnvIfSet("LOG_INCLUDE_TIMESTAMPS", true),
  colorize: await loadFromEnvIfSet("LOG_COLORIZE", true),
};
