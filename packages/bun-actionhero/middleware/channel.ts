import type { ChannelMiddleware } from "../classes/Channel";
import type { Connection } from "../classes/Connection";
import { ErrorType, TypedError } from "../classes/TypedError";

/**
 * Channel middleware that requires a valid session with a userId.
 * Use this middleware to protect channels that require authentication.
 *
 * Usage:
 * ```typescript
 * export class ProtectedChannel extends Channel {
 *   constructor() {
 *     super({
 *       name: "protected-channel",
 *       middleware: [SessionChannelMiddleware],
 *     });
 *   }
 * }
 * ```
 */
export const SessionChannelMiddleware: ChannelMiddleware = {
  runBefore: async (_channel: string, connection: Connection): Promise<void> => {
    const data = connection.session?.data as Record<string, unknown> | undefined;
    if (!connection.session || !data?.userId) {
      throw new TypedError({
        message: "Authentication required to join this channel",
        type: ErrorType.CONNECTION_CHANNEL_AUTHORIZATION,
      });
    }
  },
};
