import type { LogLevel, LoggerStream } from "../types/LogLevel";
import { loadFromEnvIfSet } from "../util/config";

export const configLogger = {
  level: loadFromEnvIfSet<LogLevel>("logger.level", "info"),
  includeTimestamps: loadFromEnvIfSet("logger.includeTimestamps", true),
  colorize: loadFromEnvIfSet("logger.colorize", true),
  stream: loadFromEnvIfSet<LoggerStream>("logger.stream", "stdout"),
  jSONObjectParsePadding: loadFromEnvIfSet("logger.jSONObjectParsePadding", 4),
};
