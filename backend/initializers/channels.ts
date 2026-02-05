import { api, logger } from "../api";
import type { Channel } from "../classes/Channel";
import type { Connection } from "../classes/Connection";
import { Initializer } from "../classes/Initializer";
import { globLoader } from "../util/glob";

const namespace = "channels";

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

    // If no channel definition exists, allow subscription by default
    // This maintains backwards compatibility
    if (!channel) {
      return;
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
    };
  }
}
