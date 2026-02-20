// Side-effect imports: ensure module augmentation from all initializers is
// visible to tsc consumers. These only define classes and augment the API
// interface — no runtime side effects beyond module evaluation.
import "./initializers/actionts";
import "./initializers/channels";
import "./initializers/connections";
import "./initializers/db";
import "./initializers/mcp";
import "./initializers/oauth";
import "./initializers/process";
import "./initializers/pubsub";
import "./initializers/redis";
import "./initializers/resque";
import "./initializers/servers";
import "./initializers/session";
import "./initializers/signals";
import "./initializers/swagger";

export * from "./api";
export type { ActionMiddleware } from "./classes/Action";
export { ErrorStatusCodes, ErrorType, TypedError } from "./classes/TypedError";
export type { KeryxConfig } from "./config";
export { deepMerge, loadFromEnvIfSet } from "./util/config";
export { globLoader } from "./util/glob";
export {
  isSecret,
  secret,
  zBooleanFromString,
  zIdOrModel,
} from "./util/zodMixins";
