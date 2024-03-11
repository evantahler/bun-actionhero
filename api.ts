import { API } from "./classes/API";
import type { Logger } from "./classes/Logger";
import { config as Config } from "./config";

export {
  type Action,
  type ActionParams,
  type ActionResponse,
} from "./classes/Action";
export { type API } from "./classes/API";
export { type Connection } from "./classes/Connection";
export { type Initializer } from "./classes/Initializer";
export { type Input } from "./classes/Input";
export { type Inputs } from "./classes/Inputs";
export { type Logger } from "./classes/Logger";
export { type Server } from "./classes/Server";

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
