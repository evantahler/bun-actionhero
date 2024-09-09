import { api, Connection, type Action, type ActionParams } from "../api";
import { HTTP_METHOD } from "../classes/Action";
import { serializeMessage } from "../ops/MessageOps";
import { messages } from "../schema/messages";
import { ensureNumber, ensureString } from "../util/formatters";
import { ensureSession } from "../util/session";
import { messageValidator } from "../util/validators";

export class MessageCrete implements Action {
  name = "message:create";
  web = { route: "/message", method: HTTP_METHOD.PUT };
  inputs = {
    body: {
      required: true,
      validator: messageValidator,
      formatter: ensureString,
      description: "The message name",
    },
  };

  async run(params: ActionParams<MessageCrete>, connection: Connection) {
    ensureSession(connection, "userId");

    const [message] = await api.db.db
      .insert(messages)
      .values({
        body: params.body,
        user_id: connection?.session?.data.userId, // TODO How can we type session data?
      })
      .returning();

    return { message: serializeMessage(message) };
  }
}

export class MessagesList implements Action {
  name = "messages:list";
  web = { route: "/messages/list", method: HTTP_METHOD.GET };
  inputs = {
    limit: {
      required: true,
      formatter: ensureNumber,
      default: 10,
    },
    offset: {
      required: true,
      formatter: ensureNumber,
      default: 0,
    },
  };

  async run(params: ActionParams<MessagesList>, connection: Connection) {
    ensureSession(connection, "userId");

    const _messages = await api.db.db
      .select()
      .from(messages)
      .limit(params.limit)
      .offset(params.offset);

    return { messages: _messages.map(serializeMessage) };
  }
}
