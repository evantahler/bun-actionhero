import type { LogLevel, LoggerStream } from "../classes/Logger";
import { loadFromEnvIfSet } from "../util/config";

export const configLogger = {
  level: await loadFromEnvIfSet<LogLevel>("logger.level", "info"),
  includeTimestamps: await loadFromEnvIfSet("logger.includeTimestamps", true),
  colorize: await loadFromEnvIfSet("logger.colorize", true),
  stream: await loadFromEnvIfSet<LoggerStream>("logger.stream", "stdout"),
  jSONObjectParsePadding: await loadFromEnvIfSet(
    "logger.jSONObjectParsePadding",
    4
  ),
};
