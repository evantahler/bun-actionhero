import type { Connection } from "./Connection";

export const CHANNEL_NAME_PATTERN = /^[a-zA-Z0-9:._-]{1,200}$/;

export type ChannelMiddlewareResponse = void;

export type ChannelMiddleware = {
  /**
   * Runs before a connection is allowed to subscribe to a channel.
   * Throw a TypedError to deny subscription.
   */
  runBefore?: (
    channel: string,
    connection: Connection,
  ) => Promise<ChannelMiddlewareResponse>;

  /**
   * Runs after a connection unsubscribes from a channel.
   * Useful for cleanup or presence tracking.
   */
  runAfter?: (
    channel: string,
    connection: Connection,
  ) => Promise<ChannelMiddlewareResponse>;
};

export type ChannelConstructorInputs = {
  /**
   * The name or pattern of the channel.
   * Can be a string for exact match or a RegExp for pattern matching.
   * Examples:
   * - "messages" - matches only "messages"
   * - /^room:.*$/ - matches "room:123", "room:abc", etc.
   */
  name: string | RegExp;
  description?: string;
  middleware?: ChannelMiddleware[];
};

/**
 * Abstract base class for PubSub channels. Channels define a `name` (exact string or RegExp)
 * and optional middleware for authorization on subscribe and cleanup on unsubscribe.
 * Subclasses can override `authorize()` and `presenceKey()` for custom behavior.
 */
export abstract class Channel {
  name: string | RegExp;
  description?: string;
  middleware: ChannelMiddleware[];

  constructor(args: ChannelConstructorInputs) {
    this.name = args.name;
    this.description = args.description ?? `A Channel: ${this.name}`;
    this.middleware = args.middleware ?? [];
  }

  /**
   * Check if this channel definition matches the requested channel name.
   */
  matches(channelName: string): boolean {
    if (typeof this.name === "string") {
      return this.name === channelName;
    }
    return this.name.test(channelName);
  }

  /**
   * Optional authorization method that can be overridden for custom logic.
   * Called after middleware runs, provides access to the parsed channel name.
   * Throw a TypedError to deny subscription.
   */
  async authorize(
    _channelName: string,
    _connection: Connection,
  ): Promise<void> {
    // Default implementation allows all subscriptions
  }

  /**
   * Returns the presence identifier for a connection in this channel.
   * Override to use a custom key (e.g. user ID from session).
   * Defaults to `connection.id`.
   */
  async presenceKey(connection: Connection): Promise<string> {
    return connection.id;
  }
}
