import { api, logger } from "../api";
import type { Channel } from "../classes/Channel";
import type { Connection } from "../classes/Connection";
import { Initializer } from "../classes/Initializer";
import { ErrorType, TypedError } from "../classes/TypedError";
import { globLoader } from "../util/glob";

const namespace = "channels";
const PRESENCE_KEY_PREFIX = "presence:";

declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<Channels["initialize"]>>;
  }
}

export class Channels extends Initializer {
  constructor() {
    super(namespace);
    this.loadPriority = 100;
  }

  /**
   * Find a channel definition that matches the given channel name.
   * Returns undefined if no matching channel is found.
   */
  findChannel = (channelName: string): Channel | undefined => {
    return api.channels.channels.find((c) => c.matches(channelName));
  };

  /**
   * Authorize a connection to subscribe to a channel.
   * Runs all middleware and the channel's authorize method.
   * Throws TypedError if authorization fails.
   */
  authorizeSubscription = async (
    channelName: string,
    connection: Connection,
  ): Promise<void> => {
    const channel = this.findChannel(channelName);

    if (!channel) {
      throw new TypedError({
        message: `Channel not found: ${channelName}`,
        type: ErrorType.CONNECTION_CHANNEL_AUTHORIZATION,
      });
    }

    // Run all middleware runBefore hooks
    for (const middleware of channel.middleware) {
      if (middleware.runBefore) {
        await middleware.runBefore(channelName, connection);
      }
    }

    // Run the channel's authorize method
    await channel.authorize(channelName, connection);
  };

  /**
   * Called when a connection unsubscribes from a channel.
   * Runs all middleware runAfter hooks.
   */
  handleUnsubscription = async (
    channelName: string,
    connection: Connection,
  ): Promise<void> => {
    const channel = this.findChannel(channelName);

    if (!channel) {
      return;
    }

    // Run all middleware runAfter hooks
    for (const middleware of channel.middleware) {
      if (middleware.runAfter) {
        await middleware.runAfter(channelName, connection);
      }
    }
  };

  /**
   * Record a connection's presence in a channel and broadcast a join event
   * if this is the first connection for that presence key.
   *
   * Redis keys:
   *   presence:{channelName} — Set of presence keys
   *   presence:{channelName}:{presenceKey} — Set of connection IDs
   */
  addPresence = async (
    channelName: string,
    connection: Connection,
  ): Promise<void> => {
    const channel = this.findChannel(channelName);
    const key = channel ? await channel.presenceKey(connection) : connection.id;

    const channelKey = `${PRESENCE_KEY_PREFIX}${channelName}`;
    const connectionSetKey = `${PRESENCE_KEY_PREFIX}${channelName}:${key}`;

    await api.redis.redis.sadd(connectionSetKey, connection.id);
    const added = await api.redis.redis.sadd(channelKey, key);

    if (added === 1) {
      await api.pubsub.broadcast(
        channelName,
        JSON.stringify({ event: "join", presenceKey: key }),
        "presence",
      );
    }
  };

  /**
   * Remove a connection's presence from a channel and broadcast a leave event
   * if this was the last connection for that presence key.
   */
  removePresence = async (
    channelName: string,
    connection: Connection,
  ): Promise<void> => {
    const channel = this.findChannel(channelName);
    const key = channel ? await channel.presenceKey(connection) : connection.id;

    const channelKey = `${PRESENCE_KEY_PREFIX}${channelName}`;
    const connectionSetKey = `${PRESENCE_KEY_PREFIX}${channelName}:${key}`;

    const removed = await api.redis.redis.srem(connectionSetKey, connection.id);
    if (removed === 0) return;

    const remaining = await api.redis.redis.scard(connectionSetKey);
    if (remaining === 0) {
      await api.redis.redis.del(connectionSetKey);
      await api.redis.redis.srem(channelKey, key);
      await api.pubsub.broadcast(
        channelName,
        JSON.stringify({ event: "leave", presenceKey: key }),
        "presence",
      );
    }
  };

  /**
   * Returns the list of presence keys for members currently in the channel
   * across all server instances.
   */
  members = async (channelName: string): Promise<string[]> => {
    const channelKey = `${PRESENCE_KEY_PREFIX}${channelName}`;
    return api.redis.redis.smembers(channelKey);
  };

  /**
   * Clear all presence data. Useful for test cleanup.
   */
  clearPresence = async (): Promise<void> => {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await api.redis.redis.scan(
        cursor,
        "MATCH",
        `${PRESENCE_KEY_PREFIX}*`,
        "COUNT",
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await api.redis.redis.del(...keys);
      }
    } while (cursor !== "0");
  };

  async initialize() {
    let channels: Channel[] = [];

    try {
      channels = await globLoader<Channel>("channels");
    } catch (e) {
      // channels directory may not exist, which is fine
      logger.debug(
        `No channels directory found or error loading channels: ${e}`,
      );
    }

    for (const c of channels) {
      if (!c.description) c.description = `A Channel: ${c.name}`;
    }

    logger.info(`loaded ${channels.length} channels`);

    return {
      channels,
      findChannel: this.findChannel,
      authorizeSubscription: this.authorizeSubscription,
      handleUnsubscription: this.handleUnsubscription,
      addPresence: this.addPresence,
      removePresence: this.removePresence,
      members: this.members,
      clearPresence: this.clearPresence,
    };
  }
}
