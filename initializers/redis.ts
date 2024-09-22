import { logger, api } from "../api";
import { Initializer } from "../classes/Initializer";
import { ErrorType, TypedError } from "../classes/TypedError";
import { config } from "../config";
import { Redis as RedisClient } from "ioredis";
import { formatConnectionStringForLogging } from "../util/connectionString";

const namespace = "redis";
const testKey = `__actionhero_test_key:${config.process.name}`;

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

    try {
      await api.redis.redis.set(testKey, Date.now());
      await api.redis.redis.expire(testKey, 1);
    } catch (e) {
      throw new TypedError({
        type: ErrorType.SERVER_INITIALIZATION,
        message: `Cannot connect to redis (${formatConnectionStringForLogging(config.redis.connectionString)}): ${e}`,
      });
    }

    logger.info(
      `redis connection established (${formatConnectionStringForLogging(config.redis.connectionString)})`,
    );
  }

  async stop() {
    if (api.redis.redis) {
      await api.redis.redis.quit(); // will wait for all pending commands to complete
      logger.info("redis connection closed");
    }
  }
}
