import { api, logger } from "../api";
import type { Channel } from "../classes/Channel";
import type { Connection } from "../classes/Connection";
import { Initializer } from "../classes/Initializer";
import { ErrorType, TypedError } from "../classes/TypedError";
import { globLoader } from "../util/glob";

const namespace = "channels";

declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<Channels["initialize"]>>;
  }
}

export class Channels extends Initializer {
  /**
   * Presence data: channelName → presenceKey → Set<connectionId>
   * Tracks which connections map to which presence keys per channel.
   */
  presence = new Map<string, Map<string, Set<string>>>();

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
   */
  addPresence = async (
    channelName: string,
    connection: Connection,
  ): Promise<void> => {
    const channel = this.findChannel(channelName);
    const key = channel ? await channel.presenceKey(connection) : connection.id;

    if (!this.presence.has(channelName)) {
      this.presence.set(channelName, new Map());
    }
    const channelPresence = this.presence.get(channelName)!;

    const isNewKey = !channelPresence.has(key);
    if (!channelPresence.has(key)) {
      channelPresence.set(key, new Set());
    }
    channelPresence.get(key)!.add(connection.id);

    if (isNewKey) {
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
    const channelPresence = this.presence.get(channelName);
    if (!channelPresence) return;

    const channel = this.findChannel(channelName);
    const key = channel ? await channel.presenceKey(connection) : connection.id;

    const connectionIds = channelPresence.get(key);
    if (!connectionIds) return;

    connectionIds.delete(connection.id);

    if (connectionIds.size === 0) {
      channelPresence.delete(key);
      await api.pubsub.broadcast(
        channelName,
        JSON.stringify({ event: "leave", presenceKey: key }),
        "presence",
      );
    }

    if (channelPresence.size === 0) {
      this.presence.delete(channelName);
    }
  };

  /**
   * Returns the list of presence keys for members currently in the channel on this server.
   */
  members = (channelName: string): string[] => {
    const channelPresence = this.presence.get(channelName);
    if (!channelPresence) return [];
    return Array.from(channelPresence.keys());
  };

  /**
   * Clear all presence data. Useful for test cleanup.
   */
  clearPresence = (): void => {
    this.presence.clear();
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
