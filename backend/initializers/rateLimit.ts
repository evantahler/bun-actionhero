import { api, logger } from "../api";
import { Initializer } from "../classes/Initializer";
import { config } from "../config";
import { RateLimitMiddleware } from "../middleware/rateLimit";

const namespace = "rateLimit";

export class RateLimit extends Initializer {
  constructor() {
    super(namespace);
    this.startPriority = 150; // after redis (110), before application (1000)
  }

  async start() {
    if (config.rateLimit.enabled) {
      api.globalMiddleware.push(RateLimitMiddleware);
      logger.info(
        `rate limiting enabled (unauth: ${config.rateLimit.unauthenticatedLimit}/${config.rateLimit.windowMs}ms, auth: ${config.rateLimit.authenticatedLimit}/${config.rateLimit.windowMs}ms)`,
      );
    }
  }

  async stop() {
    const idx = api.globalMiddleware.indexOf(RateLimitMiddleware);
    if (idx !== -1) api.globalMiddleware.splice(idx, 1);
  }
}
