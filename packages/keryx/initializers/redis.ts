import { SpanKind, SpanStatusCode } from "@opentelemetry/api";
import { Redis as RedisClient } from "ioredis";
import { api, logger } from "../api";
import { Initializer } from "../classes/Initializer";
import { ErrorType, TypedError } from "../classes/TypedError";
import { config } from "../config";
import { formatConnectionStringForLogging } from "../util/connectionString";

const namespace = "redis";
const testKey = `__keryx_test_key:${config.process.name}`;

declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<Redis["initialize"]>>;
  }
}

/**
 * Initializer that manages two Redis connections: `redis` for general commands and
 * `subscription` for PubSub. Both are created during `start()` and closed during `stop()`.
 * Exposes `api.redis.redis` and `api.redis.subscription` as ioredis `RedisClient` instances.
 */
export class Redis extends Initializer {
  constructor() {
    super(namespace);
    this.loadPriority = 200;
    this.startPriority = 110;
    this.stopPriority = 990;
  }

  async initialize() {
    const redisContainer = {} as {
      redis: RedisClient;
      subscription: RedisClient;
    };
    return redisContainer;
  }

  async start() {
    api.redis.redis = new RedisClient(config.redis.connectionString);
    api.redis.subscription = new RedisClient(config.redis.connectionString);

    try {
      await api.redis.redis.set(testKey, Date.now());
      await api.redis.redis.del(testKey);
      await api.redis.subscription.set(testKey, Date.now());
      await api.redis.subscription.del(testKey);
    } catch (e) {
      throw new TypedError({
        type: ErrorType.SERVER_INITIALIZATION,
        message: `Cannot connect to redis (${formatConnectionStringForLogging(config.redis.connectionString)}): ${e}`,
      });
    }

    // Instrument the main Redis client with tracing spans.
    // Only the general-purpose client is instrumented (not the subscription client,
    // which uses a different command flow for SUBSCRIBE/PSUBSCRIBE).
    this.instrumentRedisTracing(api.redis.redis);

    logger.info(
      `redis connections established (${formatConnectionStringForLogging(config.redis.connectionString)})`,
    );
  }

  /**
   * Wrap ioredis `sendCommand` to create an OTel span for each Redis command.
   * No-ops when tracing is disabled (the tracer returns no-op spans).
   */
  private instrumentRedisTracing(client: RedisClient) {
    const originalSendCommand = client.sendCommand.bind(client);
    client.sendCommand = function (command: any, ...rest: any[]) {
      const commandName = command?.name ?? "unknown";
      const span = api.observability.tracing.tracer.startSpan(
        `redis.${commandName}`,
        {
          kind: SpanKind.CLIENT,
          attributes: {
            "db.system": "redis",
            "db.operation.name": commandName,
          },
        },
      );

      const result: unknown = originalSendCommand(command, ...rest);
      if (result && typeof (result as Promise<unknown>).then === "function") {
        (result as Promise<unknown>).then(
          () => span.end(),
          (e: Error) => {
            span.recordException(e);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: e.message,
            });
            span.end();
          },
        );
      } else {
        span.end();
      }
      return result;
    } as typeof client.sendCommand;
  }

  async stop() {
    let acted = false;

    if (api.redis.redis) {
      try {
        await api.redis.redis.quit();
        acted = true;
      } catch (e) {
        logger.error(`error closing redis connection: ${e}`);
      }
    }

    if (api.redis.subscription) {
      try {
        await api.redis.subscription.quit();
        acted = true;
      } catch (e) {
        logger.error(`error closing redis subscription connection: ${e}`);
      }
    }

    if (acted) logger.info("redis connections closed");
  }
}
