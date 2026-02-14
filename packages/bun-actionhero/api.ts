import { API } from "./classes/API";
import type { Logger } from "./classes/Logger";
import { config as Config } from "./config";

export {
  Action,
  type ActionConstructorInputs,
  type ActionParams,
  type ActionResponse,
  type McpActionConfig,
  type OAuthActionResponse,
} from "./classes/Action";
export { API, RUN_MODE } from "./classes/API";
export {
  Channel,
  type ChannelConstructorInputs,
  type ChannelMiddleware,
} from "./classes/Channel";
export { Connection } from "./classes/Connection";
export { Initializer } from "./classes/Initializer";
export { Logger } from "./classes/Logger";
export { Server } from "./classes/Server";
export type {
  FanOutJob,
  FanOutOptions,
  FanOutResult,
  FanOutStatus,
} from "./initializers/actionts";

declare namespace globalThis {
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
