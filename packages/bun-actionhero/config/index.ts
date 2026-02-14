import { existsSync } from "fs";
import path from "path";
import { configDatabase } from "./database";
import { configLogger } from "./logger";
import { configProcess } from "./process";
import { configRedis } from "./redis";
import { configServerMcp } from "./server/mcp";
import { configServerWeb } from "./server/web";
import { configSession } from "./session";
import { configTasks } from "./tasks";

const defaultConfig = {
  process: configProcess,
  logger: configLogger,
  database: configDatabase,
  redis: configRedis,
  session: configSession,
  server: { web: configServerWeb, mcp: configServerMcp },
  tasks: configTasks,
};

export type Config = typeof defaultConfig;

/**
 * Deep merge source into target. Source values override target values.
 * Arrays are replaced, not merged.
 */
function deepMerge<T extends Record<string, any>>(
  target: T,
  source: Record<string, any>,
): T {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const targetVal = (result as any)[key];
    const sourceVal = source[key];

    if (
      sourceVal !== null &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      (result as any)[key] = deepMerge(targetVal, sourceVal);
    } else {
      (result as any)[key] = sourceVal;
    }
  }
  return result;
}

/**
 * Load user config overrides from process.cwd()/config/index.ts if it exists,
 * and deep-merge them onto the framework defaults.
 */
async function loadConfig(): Promise<Config> {
  const userConfigPath = path.join(process.cwd(), "config", "index.ts");
  if (existsSync(userConfigPath)) {
    try {
      const userModule = await import(userConfigPath);
      const userConfig = userModule.config || userModule.default;
      if (userConfig && typeof userConfig === "object") {
        return deepMerge(defaultConfig, userConfig);
      }
    } catch {
      // If user config fails to load, fall back to defaults
    }
  }
  return defaultConfig;
}

export const config = await loadConfig();
