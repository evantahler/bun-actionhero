import { API } from "./classes/API";
import type { Logger } from "./classes/Logger";
import { config as Config } from "./config";

export { type ActionParams, type ActionResponse } from "./classes/Action";

declare module globalThis {
  let api: API;
  let logger: Logger;
  let config: typeof Config;
}

if (!globalThis.api) {
  globalThis.api = new API();
  globalThis.logger = globalThis.api.logger;
  globalThis.config = Config;
}

export const api = globalThis.api;
export const logger = globalThis.logger;
export const config = globalThis.config;
