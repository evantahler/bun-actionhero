import colors from "colors";

export const LogLevels = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
] as const;
export type LogLevel = (typeof LogLevels)[number];

const JSONObjectParsePadding = 4;

export class Logger {
  level: LogLevel;
  colorize: boolean;
  includeTimestamps: boolean;

  constructor(level: LogLevel, colorize: boolean, includeTimestamps: boolean) {
    this.level = level;
    this.colorize = colorize;
    this.includeTimestamps = includeTimestamps;
  }

  log(level: LogLevel, message: string, object?: any) {
    if (LogLevels.indexOf(level) < LogLevels.indexOf(this.level)) {
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
        ? JSON.stringify(object, null, JSONObjectParsePadding)
        : "";
    if (this.colorize && prettyObject.length > 0) {
      prettyObject = colors.cyan(prettyObject);
    }

    console.log(`${timestamp} ${formattedLevel} ${message} ${prettyObject}`);
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
        return colors.green;
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
