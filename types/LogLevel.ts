export const LogLevels = [
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
] as const;

export type LogLevel = (typeof LogLevels)[number];

export type LoggerStream = "stdout" | "stderr";
