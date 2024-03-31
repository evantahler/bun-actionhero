import { logger, api } from "../api";
import { Initializer } from "../classes/Initializer";
import { config } from "../config";
import { Redis as RedisClient } from "ioredis";

const namespace = "redis";

declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<Redis["initialize"]>>;
  }
}

export class Redis extends Initializer {
  constructor() {
    super(namespace);
    this.startPriority = 110;
    this.stopPriority = 900;
  }

  async initialize() {
    const redisContainer = {} as { redis: RedisClient };
    return redisContainer;
  }

  async start() {
    api.redis.redis = new RedisClient(config.redis.connectionString);
    logger.info("redis connection established");
  }

  async stop() {
    if (api.redis.redis) {
      await api.redis.redis.quit(); // will wait for all pending commands to complete
      logger.info("redis connection closed");
    }
  }
}
