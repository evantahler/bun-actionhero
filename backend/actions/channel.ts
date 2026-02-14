import {
  api,
  HTTP_METHOD,
  SessionMiddleware,
  type Action,
  type ActionParams,
} from "bun-actionhero";
import { z } from "zod";

export class ChannelMembers implements Action {
  name = "channel:members";
  description =
    "Get the list of presence keys for members currently subscribed to a PubSub channel. Requires an active session.";
  middleware = [SessionMiddleware];
  web = { route: "/channel/:channel/members", method: HTTP_METHOD.GET };
  inputs = z.object({
    channel: z.string().describe("The channel name to query"),
  });

  async run(params: ActionParams<ChannelMembers>) {
    return { members: api.channels.members(params.channel) };
  }
}
