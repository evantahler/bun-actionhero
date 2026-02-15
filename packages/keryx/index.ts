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
export { ExitCode } from "./classes/ExitCode";
export { Initializer } from "./classes/Initializer";
export { Logger, LogLevel } from "./classes/Logger";
export { Server } from "./classes/Server";
export {
  ErrorStatusCodes,
  ErrorType,
  TypedError,
  type TypedErrorArgs,
} from "./classes/TypedError";
export { DEFAULT_QUEUE, HTTP_METHOD } from "./classes/Action";
export type {
  ActionMiddleware,
  ActionMiddlewareResponse,
} from "./classes/Action";
export { CHANNEL_NAME_PATTERN } from "./classes/Channel";
export type { InitializerSortKeys } from "./classes/Initializer";
export type {
  FanOutJob,
  FanOutOptions,
  FanOutResult,
  FanOutStatus,
} from "./initializers/actionts";
export type { SessionData } from "./initializers/session";
export { loadFromEnvIfSet } from "./util/config";
export { formatConnectionStringForLogging } from "./util/connectionString";
export { globLoader } from "./util/glob";
export {
  isSecret,
  secret,
  zBooleanFromString,
  zIdOrModel,
  type TableWithId,
} from "./util/zodMixins";
export {
  checkRateLimit,
  RateLimitMiddleware,
  type RateLimitInfo,
  type RateLimitOverrides,
} from "./middleware/rateLimit";

declare namespace globalThis {
  let api: API;
  let logger: Logger;
  let config: typeof Config;
}

if (!globalThis.api) {
  // @ts-ignore — Module-augmented properties (db, redis, actions, etc.) are populated during initialize()
  globalThis.api = new API();
  globalThis.logger = globalThis.api.logger;
  globalThis.config = Config;
}

export const api = globalThis.api;
export const logger = globalThis.logger;
export const config = globalThis.config;
