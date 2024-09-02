import { LogLevel, type LoggerStream } from "../classes/Logger";
import { loadFromEnvIfSet } from "../util/config";

export const configLogger = {
  level: await loadFromEnvIfSet<LogLevel>("BUN_LOGGER_LEVEL", LogLevel.info),
  includeTimestamps: await loadFromEnvIfSet(
    "BUN_LOGGER_INCLUDE_TIMESTAMPS",
    true,
  ),
  colorize: await loadFromEnvIfSet("BUN_LOGGER_COLORIZE", true),
  stream: await loadFromEnvIfSet<LoggerStream>("BUN_LOGGER_STREAM", "stdout"),
};
