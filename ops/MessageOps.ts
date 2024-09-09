import type { Message } from "../schema/messages";

export function serializeMessage(message: Message) {
  return {
    id: message.id,
    body: message.body,
    user_id: message.user_id,
    createdAt: message.createdAt.getTime(),
    updatedAt: message.updatedAt.getTime(),
  };
}
