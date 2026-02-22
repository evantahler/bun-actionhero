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

/**
 * The Logger Class.  I write to stdout or stderr, and can be colorized.
 */
export class Logger {
  /** Minimum log level to output. Messages below this level are silently dropped. */
  level: LogLevel;
  /** Whether to apply ANSI color codes to the output. */
  colorize: boolean;
  /** Whether to prepend an ISO-8601 timestamp to each log line. */
  includeTimestamps: boolean;
  /** Indentation spaces used when JSON-stringifying the optional object argument. */
  jSONObjectParsePadding: number;
  /** When `true`, all logging is suppressed (used by CLI mode). */
  quiet: boolean;
  /** The output function — defaults to `console.log`. Override for custom transports. */
  outputStream: typeof console.log;

  constructor(config: typeof configLogger) {
    this.level = config.level;
    this.colorize = config.colorize;
    this.includeTimestamps = config.includeTimestamps;
    this.jSONObjectParsePadding = 4;
    this.quiet = false;
    this.outputStream = console.log;
  }

  /**
   * Core logging method. Formats and writes a log line to `outputStream` if the given
   * level meets the minimum threshold. Optionally includes a timestamp and pretty-printed object.
   *
   * @param level - The severity level of this log entry.
   * @param message - The log message string.
   * @param object - An optional object to JSON-stringify and append to the log line.
   */
  log(level: LogLevel, message: string, object?: any) {
    if (this.quiet) return;

    if (
      Object.values(LogLevel).indexOf(level) <
      Object.values(LogLevel).indexOf(this.level)
    ) {
      return;
    }

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

    this.outputStream(
      `${timestamp} ${formattedLevel} ${message} ${prettyObject}`,
    );
  }

  /**
   * Log a trace message.
   * @param message - The message to log.
   * @param object - The object to log.
   */
  trace(message: string, object?: any) {
    this.log(LogLevel.trace, message, object);
  }

  /**
   * Log a debug message.
   * @param message - The message to log.
   * @param object - The object to log.
   */
  debug(message: string, object?: any) {
    this.log(LogLevel.debug, message, object);
  }

  /**
   * Log an info message.
   * @param message - The message to log.
   * @param object - The object to log.
   */
  info(message: string, object?: any) {
    this.log(LogLevel.info, message, object);
  }

  /**
   * Log a warning.
   * @param message - The message to log.
   * @param object - The object to log.
   */
  warn(message: string, object?: any) {
    this.log(LogLevel.warn, message, object);
  }

  /**
   * Log an error.
   * @param message - The message to log.
   * @param object - The object to log.
   */
  error(message: string, object?: any) {
    this.log(LogLevel.error, message, object);
  }

  /**
   * Log a fatal error.
   * @param message - The message to log.
   * @param object - The object to log.
   */
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
