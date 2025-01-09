const logLevels = ["none", "error", "warn", "info", "debug"] as const;
export type LogLevel = (typeof logLevels)[number];
export type Logger = typeof logger;

const levelRef = {
  current: "warn" as LogLevel
};
export const setLogLevel = (newLogLevel: LogLevel) => {
  levelRef.current = newLogLevel;
};

export const logger = {
  error: (...data: unknown[]) => {
    if (
      logLevels.indexOf(levelRef.current) >= logLevels.indexOf("error" as const)
    ) {
      console.error(...data);
    }
  },
  warn: (...data: unknown[]) => {
    if (
      logLevels.indexOf(levelRef.current) >= logLevels.indexOf("warn" as const)
    ) {
      console.warn(...data);
    }
  },
  info: (...data: unknown[]) => {
    if (
      logLevels.indexOf(levelRef.current) >= logLevels.indexOf("info" as const)
    ) {
      console.info(...data);
    }
  },
  log: (...data: unknown[]) => {
    if (
      logLevels.indexOf(levelRef.current) >= logLevels.indexOf("info" as const)
    ) {
      console.log(...data);
    }
  },
  debug: (...data: unknown[]) => {
    if (
      logLevels.indexOf(levelRef.current) >= logLevels.indexOf("debug" as const)
    ) {
      console.debug(...data);
    }
  }
};
