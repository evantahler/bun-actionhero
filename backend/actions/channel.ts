import { z } from "zod";
import { api, type Action, type ActionParams } from "../api";
import { HTTP_METHOD } from "../classes/Action";
import { SessionMiddleware } from "../middleware/session";

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
