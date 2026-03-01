// Side-effect imports: ensure module augmentation from all initializers is
// visible to tsc consumers. These only define classes and augment the API
// interface — no runtime side effects beyond module evaluation.
import "./initializers/actionts";
import "./initializers/channels";
import "./initializers/connections";
import "./initializers/db";
import "./initializers/mcp";
import "./initializers/oauth";
import "./initializers/observability";
import "./initializers/process";
import "./initializers/pubsub";
import "./initializers/redis";
import "./initializers/resque";
import "./initializers/servers";
import "./initializers/session";
import "./initializers/signals";
import "./initializers/swagger";

export * from "./api";
export { HTTP_METHOD } from "./classes/Action";
export type { ActionMiddleware } from "./classes/Action";
export { CHANNEL_NAME_PATTERN } from "./classes/Channel";
export type { ChannelMiddleware } from "./classes/Channel";
export { Connection } from "./classes/Connection";
export { LogLevel } from "./classes/Logger";
export { ErrorStatusCodes, ErrorType, TypedError } from "./classes/TypedError";
export type { KeryxConfig } from "./config";
export type { SessionData } from "./initializers/session";
export { RateLimitMiddleware, checkRateLimit } from "./middleware/rateLimit";
export type { WebServer } from "./servers/web";
export { buildProgram } from "./util/cli";
export { deepMerge, loadFromEnvIfSet } from "./util/config";
export { globLoader } from "./util/glob";
export {
  isSecret,
  secret,
  zBooleanFromString,
  zIdOrModel,
} from "./util/zodMixins";
