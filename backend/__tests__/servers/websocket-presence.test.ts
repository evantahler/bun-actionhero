import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";
import { api } from "../../api";
import { HOOK_TIMEOUT } from "./../setup";
import {
  buildWebSocket,
  createSession,
  createUser,
  subscribeToChannel,
} from "./websocket-helpers";

beforeAll(async () => {
  await api.start();
  await api.db.clearDatabase();
}, HOOK_TIMEOUT);

afterAll(async () => {
  await api.stop();
}, HOOK_TIMEOUT);

beforeEach(async () => {
  await api.db.clearDatabase();
  api.channels.clearPresence();
});

test("should track presence when subscribing to a channel", async () => {
  const { socket: socket1, messages: messages1 } = await buildWebSocket();
  const { socket: socket2, messages: messages2 } = await buildWebSocket();

  await createUser(
    socket1,
    messages1,
    "Marco",
    "marco@example.com",
    "abc12345",
  );
  await createUser(socket2, messages2, "Polo", "polo@example.com", "abc12345");
  await createSession(socket1, messages1, "marco@example.com", "abc12345");
  await createSession(socket2, messages2, "polo@example.com", "abc12345");

  // Subscribe first user
  await subscribeToChannel(socket1, messages1, "messages");
  let members = api.channels.members("messages");
  expect(members.length).toBe(1);

  // Subscribe second user
  await subscribeToChannel(socket2, messages2, "messages");
  members = api.channels.members("messages");
  expect(members.length).toBe(2);

  socket1.close();
  socket2.close();
  await Bun.sleep(100);
});

test("should remove presence on unsubscribe", async () => {
  const { socket, messages } = await buildWebSocket();

  await createUser(socket, messages, "Marco", "marco@example.com", "abc12345");
  await createSession(socket, messages, "marco@example.com", "abc12345");
  await subscribeToChannel(socket, messages, "messages");

  expect(api.channels.members("messages").length).toBe(1);

  // Unsubscribe
  socket.send(
    JSON.stringify({ messageType: "unsubscribe", channel: "messages" }),
  );
  await Bun.sleep(100);

  expect(api.channels.members("messages").length).toBe(0);

  socket.close();
  await Bun.sleep(100);
});

test("should remove presence on disconnect", async () => {
  const { socket, messages } = await buildWebSocket();

  await createUser(socket, messages, "Marco", "marco@example.com", "abc12345");
  await createSession(socket, messages, "marco@example.com", "abc12345");
  await subscribeToChannel(socket, messages, "messages");

  expect(api.channels.members("messages").length).toBe(1);

  // Close the socket (disconnect)
  socket.close();
  await Bun.sleep(100);

  expect(api.channels.members("messages").length).toBe(0);
});

test("should use presenceKey from channel (user ID for messages channel)", async () => {
  const { socket: socket1, messages: messages1 } = await buildWebSocket();
  const { socket: socket2, messages: messages2 } = await buildWebSocket();

  // Create the user via socket1
  await createUser(
    socket1,
    messages1,
    "Marco",
    "marco@example.com",
    "abc12345",
  );
  await createSession(socket1, messages1, "marco@example.com", "abc12345");
  await subscribeToChannel(socket1, messages1, "messages");

  // Socket2 logs in as the same user (second tab)
  socket2.send(
    JSON.stringify({
      messageType: "action",
      action: "session:create",
      messageId: 1,
      params: { email: "marco@example.com", password: "abc12345" },
    }),
  );
  while (messages2.length < 1) await Bun.sleep(10);

  socket2.send(
    JSON.stringify({
      messageType: "subscribe",
      channel: "messages",
    }),
  );
  while (messages2.length < 2) await Bun.sleep(10);

  // Same user = same presenceKey, so only 1 member
  const members = api.channels.members("messages");
  expect(members.length).toBe(1);
  expect(members[0]).toBe("1"); // userId as string

  // Close first tab — user still present via second tab
  socket1.close();
  await Bun.sleep(100);
  expect(api.channels.members("messages").length).toBe(1);

  // Close second tab — now fully gone
  socket2.close();
  await Bun.sleep(100);
  expect(api.channels.members("messages").length).toBe(0);
});

test("should broadcast join/leave events to other subscribers", async () => {
  const { socket: socket1, messages: messages1 } = await buildWebSocket();
  const { socket: socket2, messages: messages2 } = await buildWebSocket();

  await createUser(
    socket1,
    messages1,
    "Marco",
    "marco@example.com",
    "abc12345",
  );
  await createUser(socket2, messages2, "Polo", "polo@example.com", "abc12345");
  await createSession(socket1, messages1, "marco@example.com", "abc12345");
  await createSession(socket2, messages2, "polo@example.com", "abc12345");

  // User 1 subscribes first
  await subscribeToChannel(socket1, messages1, "messages");

  // Record the baseline so we only inspect messages arriving after this point
  const baselineIndex = messages1.length;

  // User 2 subscribes — user 1 should receive a join event for presenceKey "2"
  await subscribeToChannel(socket2, messages2, "messages");
  await Bun.sleep(200);

  const findPresenceEvents = (
    msgs: MessageEvent[],
    startIndex: number,
    eventType: string,
    presenceKey: string,
  ) =>
    msgs.slice(startIndex).filter((m) => {
      try {
        const outer = JSON.parse(m.data);
        const parsed = JSON.parse(outer.message?.message);
        return parsed.event === eventType && parsed.presenceKey === presenceKey;
      } catch {
        return false;
      }
    });

  const joinEvents = findPresenceEvents(messages1, baselineIndex, "join", "2");
  expect(joinEvents.length).toBeGreaterThanOrEqual(1);

  // User 2 disconnects — user 1 should receive a leave event for presenceKey "2"
  const preLeaveIndex = messages1.length;
  socket2.close();
  await Bun.sleep(200);

  const leaveEvents = findPresenceEvents(
    messages1,
    preLeaveIndex,
    "leave",
    "2",
  );
  expect(leaveEvents.length).toBeGreaterThanOrEqual(1);

  socket1.close();
  await Bun.sleep(100);
});
