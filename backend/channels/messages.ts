import type { SessionImpl } from "../actions/session";
import { Channel } from "keryx";
import type { Connection } from "keryx";
import { SessionChannelMiddleware } from "../middleware/channel";

/**
 * The messages channel requires authentication.
 * Only users with a valid session can subscribe to this channel.
 */
export class MessagesChannel extends Channel {
  constructor() {
    super({
      name: "messages",
      description: "Authenticated channel for real-time messages",
      middleware: [SessionChannelMiddleware],
    });
  }

  async presenceKey(connection: Connection<SessionImpl>): Promise<string> {
    return connection.session?.data?.userId?.toString() ?? connection.id;
  }
}
