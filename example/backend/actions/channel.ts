import { api, type Action, type ActionParams } from "keryx";
import { HTTP_METHOD } from "keryx/classes/Action.ts";
import { CHANNEL_NAME_PATTERN } from "keryx/classes/Channel.ts";
import { RateLimitMiddleware } from "keryx/middleware/rateLimit.ts";
import { z } from "zod";
import { SessionMiddleware } from "../middleware/session";

export class ChannelMembers implements Action {
  name = "channel:members";
  description =
    "Get the list of presence keys for members currently subscribed to a PubSub channel. Requires an active session.";
  middleware = [RateLimitMiddleware, SessionMiddleware];
  web = { route: "/channel/:channel/members", method: HTTP_METHOD.GET };
  inputs = z.object({
    channel: z
      .string()
      .regex(CHANNEL_NAME_PATTERN, "Invalid channel name")
      .describe("The channel name to query"),
  });

  async run(params: ActionParams<ChannelMembers>) {
    return { members: await api.channels.members(params.channel) };
  }
}
