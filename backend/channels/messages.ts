import { Channel } from "../api";
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
}
