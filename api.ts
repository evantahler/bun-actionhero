import { API } from "./classes/API";
import type { Logger } from "./classes/Logger";

declare module globalThis {
  let api: API;
  let logger: Logger;
}

if (!globalThis.api) {
  globalThis.api = new API();
  globalThis.logger = globalThis.api.logger;
}

export const api = globalThis.api;
export const logger = globalThis.logger;
