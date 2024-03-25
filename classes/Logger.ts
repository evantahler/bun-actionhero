import colors from "colors";

import type { configLogger } from "../config/logger";

export enum LogLevel {
  "trace" = "trace",
  "debug" = "debug",
  "info" = "info",
  "warn" = "warn",
  "error" = "error",
  "fatal" = "fatal",
}

export type LoggerStream = "stdout" | "stderr";

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
    if (
      Object.values(LogLevel).indexOf(level) <
      Object.values(LogLevel).indexOf(this.level)
    ) {
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
    this.log(LogLevel.trace, message, object);
  }

  debug(message: string, object?: any) {
    this.log(LogLevel.debug, message, object);
  }

  info(message: string, object?: any) {
    this.log(LogLevel.info, message, object);
  }

  warn(message: string, object?: any) {
    this.log(LogLevel.warn, message, object);
  }

  error(message: string, object?: any) {
    this.log(LogLevel.error, message, object);
  }

  fatal(message: string, object?: any) {
    this.log(LogLevel.fatal, message, object);
  }

  private colorFromLopLevel(level: LogLevel) {
    switch (level) {
      case LogLevel.trace:
        return colors.gray;
      case LogLevel.debug:
        return colors.blue;
      case LogLevel.info:
        return colors.green;
      case LogLevel.warn:
        return colors.yellow;
      case LogLevel.error:
        return colors.red;
      case LogLevel.fatal:
        return colors.magenta;
    }
  }
}
