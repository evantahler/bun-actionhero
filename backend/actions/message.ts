import { desc, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { api, Connection, type Action, type ActionParams } from "../api";
import { HTTP_METHOD } from "../classes/Action";
import { serializeMessage } from "../ops/MessageOps";
import { messages } from "../schema/messages";
import { users } from "../schema/users";
import type { SessionImpl } from "./session";
import { SessionMiddleware } from "../middleware/session";

export class MessageCrete implements Action {
  name = "message:create";
  description = "Create a message";
  middleware = [SessionMiddleware];
  web = { route: "/message", method: HTTP_METHOD.PUT };
  inputs = z.object({
    body: z
      .string()
      .min(1, "Message body is required")
      .max(1000, "Message must be less than 1000 characters")
      .describe("The message body"),
  });

  async run(
    params: ActionParams<MessageCrete>,
    connection: Connection<SessionImpl>,
  ) {
    const userId = connection!.session!.data.userId!;

    const [message] = await api.db.db
      .insert(messages)
      .values({ body: params.body, user_id: userId })
      .returning();

    const [user] = await api.db.db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    await api.pubsub.broadcast(
      "messages",
      { message: serializeMessage(message, user.name) },
      `user:${userId}`,
    );

    return { message: serializeMessage(message) };
  }
}

export class MessagesList implements Action {
  name = "messages:list";
  description = "List messages";
  middleware = [SessionMiddleware];
  web = { route: "/messages/list", method: HTTP_METHOD.GET };
  inputs = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(10),
    offset: z.coerce.number().int().min(0).default(0),
  });

  async run(
    params: ActionParams<MessagesList>,
    connection: Connection<SessionImpl>,
  ) {
    const _messages = await api.db.db
      .select({
        id: messages.id,
        body: messages.body,
        createdAt: messages.createdAt,
        updatedAt: messages.updatedAt,
        user_id: messages.user_id,
        user_name: users.name,
      })
      .from(messages)
      .orderBy(desc(messages.id))
      .limit(params.limit)
      .offset(params.offset)
      .leftJoin(users, eq(users.id, messages.user_id));

    return {
      messages: _messages.map((m) =>
        serializeMessage(m, m.user_name ? m.user_name : undefined),
      ),
    };
  }
}

export class MessagesCleanup implements Action {
  name = "messages:cleanup";
  description = "cleanup messages older than 24 hours";
  task = { frequency: 1000 * 60 * 60, queue: "default" }; // run the task every hour
  inputs = z.object({
    age: z.coerce
      .number()
      .int()
      .min(1000)
      .default(1000 * 60 * 60 * 24), // 24 hours
  });
  async run(params: ActionParams<MessagesCleanup>) {
    const _messages = await api.db.db
      .delete(messages)
      .where(lt(messages.createdAt, new Date(Date.now() - params.age)))
      .returning();

    return {
      messagesDeleted: _messages.length,
    };
  }
}

export class MessagesHello implements Action {
  name = "messages:hello";
  description = "broadcast a hello message to all users in the chat room";
  task = { frequency: 1000 * 60, queue: "default" }; // run the task every minute
  inputs = z.object({});
  async run() {
    const [message] = await api.db.db
      .insert(messages)
      .values({
        body: "Hello! The current time is " + new Date().toISOString(),
        user_id: api.application.defaultUser.id,
      })
      .returning();

    const serializedMessage = serializeMessage(
      message,
      api.application.defaultUser.name,
    );

    await api.pubsub.broadcast(
      "messages",
      { message: serializedMessage },
      `user:${api.application.defaultUser.id}`,
    );

    return { message: serializedMessage.body };
  }
}
