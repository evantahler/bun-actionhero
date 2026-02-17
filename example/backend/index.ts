import { api, config, logger } from "keryx";

// Point the API to this project's directory for loading user actions/initializers/channels
api.rootDir = import.meta.dir;

export { api, config, logger };

// Re-export framework types for convenience
export {
  Action,
  API,
  Channel,
  Connection,
  ErrorStatusCodes,
  ErrorType,
  globLoader,
  Initializer,
  isSecret,
  loadFromEnvIfSet,
  Logger,
  RUN_MODE,
  secret,
  Server,
  TypedError,
  zBooleanFromString,
  zIdOrModel,
  type ActionConstructorInputs,
  type ActionMiddleware,
  type ActionParams,
  type ActionResponse,
  type ChannelConstructorInputs,
  type ChannelMiddleware,
  type FanOutJob,
  type FanOutOptions,
  type FanOutResult,
  type FanOutStatus,
  type McpActionConfig,
  type OAuthActionResponse,
} from "keryx";
