import colors from "colors";

import { LogLevels, type LogLevel, type LoggerStream } from "../types/LogLevel";
import type { configLogger } from "../config/logger";

/**
 * The Logger Class.  I write to stdout or stderr, and can be colorized.
 */
export class Logger {
  level: LogLevel;
  colorize: boolean;
  includeTimestamps: boolean;
  stream: LoggerStream;
  jSONObjectParsePadding: number;

  constructor(config: typeof configLogger) {
    this.level = config.level;
    this.colorize = config.colorize;
    this.includeTimestamps = config.includeTimestamps;
    this.stream = config.stream;
    this.jSONObjectParsePadding = config.jSONObjectParsePadding;
  }

  log(level: LogLevel, message: string, object?: any) {
    if (LogLevels.indexOf(level) < LogLevels.indexOf(this.level)) {
      return;
    }

    const outputStream = this.stream === "stdout" ? console.log : console.error;

    let timestamp = this.includeTimestamps ? `${new Date().toISOString()}` : "";
    if (this.colorize && timestamp.length > 0) {
      timestamp = colors.gray(timestamp);
    }

    let formattedLevel = `[${level}]`;
    if (this.colorize) {
      formattedLevel = this.colorFromLopLevel(level)(formattedLevel);
    }

    let prettyObject =
      object !== undefined
        ? JSON.stringify(object, null, this.jSONObjectParsePadding)
        : "";
    if (this.colorize && prettyObject.length > 0) {
      prettyObject = colors.cyan(prettyObject);
    }

    outputStream(`${timestamp} ${formattedLevel} ${message} ${prettyObject}`);
  }

  trace(message: string, object?: any) {
    this.log("trace", message, object);
  }

  debug(message: string, object?: any) {
    this.log("debug", message, object);
  }

  info(message: string, object?: any) {
    this.log("info", message, object);
  }

  warn(message: string, object?: any) {
    this.log("warn", message, object);
  }

  error(message: string, object?: any) {
    this.log("error", message, object);
  }

  fatal(message: string, object?: any) {
    this.log("fatal", message, object);
  }

  private colorFromLopLevel(level: LogLevel) {
    switch (level) {
      case "trace":
        return colors.gray;
      case "debug":
        return colors.blue;
      case "info":
        return colors.green;
      case "warn":
        return colors.yellow;
      case "error":
        return colors.red;
      case "fatal":
        return colors.magenta;
    }
  }
}
