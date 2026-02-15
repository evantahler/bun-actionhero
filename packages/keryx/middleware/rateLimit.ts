import { api } from "../index";
import type { ActionMiddleware } from "../classes/Action";
import type { Connection } from "../classes/Connection";
import { ErrorType, TypedError } from "../classes/TypedError";
import { config } from "../config";

export type RateLimitInfo = {
  limit: number;
  remaining: number;
  resetAt: number; // unix timestamp in seconds
  retryAfter?: number; // seconds until window resets (only when limited)
};

export type RateLimitOverrides = {
  limit?: number;
  windowMs?: number;
  keyPrefix?: string;
};

/**
 * Sliding window rate-limit check using Redis.
 * Exported so OAuth and other non-action handlers can reuse it.
 * Pass `overrides` to use a custom limit/window instead of the global config.
 */
export async function checkRateLimit(
  identifier: string,
  isAuthenticated: boolean,
  overrides?: RateLimitOverrides,
): Promise<RateLimitInfo> {
  const windowMs = overrides?.windowMs ?? config.rateLimit.windowMs;
  const keyPrefix = overrides?.keyPrefix ?? config.rateLimit.keyPrefix;
  const limit =
    overrides?.limit ??
    (isAuthenticated
      ? config.rateLimit.authenticatedLimit
      : config.rateLimit.unauthenticatedLimit);
  const windowSizeSec = Math.ceil(windowMs / 1000);
  const now = Date.now();
  const currentWindow = Math.floor(now / windowMs);
  const previousWindow = currentWindow - 1;
  const windowProgress = (now % windowMs) / windowMs; // 0.0 to 1.0

  const currentKey = `${keyPrefix}:${identifier}:${currentWindow}`;
  const previousKey = `${keyPrefix}:${identifier}:${previousWindow}`;

  // Pipeline: increment current window, set TTL, and get previous window count
  const pipeline = api.redis.redis.pipeline();
  pipeline.incr(currentKey);
  pipeline.expire(currentKey, windowSizeSec * 2);
  pipeline.get(previousKey);
  const results = await pipeline.exec();

  const currentCount = (results![0][1] as number) || 0;
  const previousCount = parseInt((results![2][1] as string) || "0", 10);

  // Sliding window estimate: weight previous window by remaining overlap
  const estimatedCount =
    Math.floor(previousCount * (1 - windowProgress)) + currentCount;

  const remaining = Math.max(0, limit - estimatedCount);
  const resetAt = Math.ceil(((currentWindow + 1) * windowMs) / 1000);

  if (estimatedCount > limit) {
    const retryAfter = Math.ceil((windowMs - (now % windowMs)) / 1000);
    return { limit, remaining: 0, resetAt, retryAfter };
  }

  return { limit, remaining, resetAt };
}

export const RateLimitMiddleware: ActionMiddleware = {
  runBefore: async (_params, connection: Connection) => {
    if (!config.rateLimit.enabled) return;

    const isAuthenticated = !!connection.session?.data?.userId;
    const identifier = isAuthenticated
      ? `user:${connection.session!.data.userId}`
      : `ip:${connection.identifier}`;

    const info = await checkRateLimit(identifier, isAuthenticated);

    // Store on connection for header injection by web server
    connection.rateLimitInfo = info;

    if (info.retryAfter !== undefined) {
      throw new TypedError({
        message: `Rate limit exceeded. Try again in ${info.retryAfter} seconds.`,
        type: ErrorType.CONNECTION_RATE_LIMITED,
      });
    }
  },
};
