import { api } from "bun-actionhero";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { HOOK_TIMEOUT } from "./../setup";
import { buildWebSocket } from "./websocket-helpers";

beforeAll(async () => {
  await api.start();
  await api.db.clearDatabase();
}, HOOK_TIMEOUT);

afterAll(async () => {
  await api.stop();
}, HOOK_TIMEOUT);

test("request to an action", async () => {
  const { socket, messages } = await buildWebSocket();

  socket.send(
    JSON.stringify({
      messageType: "action",
      action: "status",
      messageId: 1,
      params: {},
    }),
  );

  while (messages.length === 0) await Bun.sleep(10);

  expect(messages.length).toBe(1);
  const message = JSON.parse(messages[0].data);
  expect(message.messageId).toBe(1);
  expect(message.response.name).toBe("test-server");
  socket.close();
});

test("request to an action with params", async () => {
  const { socket, messages } = await buildWebSocket();

  socket.send(
    JSON.stringify({
      messageType: "action",
      action: "user:create",
      messageId: 1,
      params: {
        name: "Mario Mario",
        email: "mario@example.com",
        password: "mushroom1",
      },
    }),
  );

  while (messages.length === 0) await Bun.sleep(10);

  expect(messages.length).toBe(1);
  const message = JSON.parse(messages[0].data);
  expect(message.messageId).toBe(1);
  expect(message.response.user.id).toBeGreaterThan(0);
  expect(message.response.user.email).toBe("mario@example.com");
  socket.close();
});

test("action with errors", async () => {
  const { socket, messages } = await buildWebSocket();

  socket.send(
    JSON.stringify({
      messageType: "action",
      action: "user:create",
      messageId: 1,
      params: {
        name: "Mario Mario",
        email: "mario@example.com",
        password: undefined,
      },
    }),
  );

  while (messages.length === 0) await Bun.sleep(10);

  expect(messages.length).toBe(1);
  const message = JSON.parse(messages[0].data);
  expect(message.messageId).toBe(1);
  expect(message.error.message).toBe("Missing required param: password");
  expect(message.error.key).toBe("password");
  expect(message.error.type).toBe("CONNECTION_ACTION_PARAM_REQUIRED");
  socket.close();
});

test("unknown actions", async () => {
  const { socket, messages } = await buildWebSocket();

  socket.send(
    JSON.stringify({
      messageType: "action",
      action: "unknown",
      messageId: 1,
      params: {},
    }),
  );

  while (messages.length === 0) await Bun.sleep(10);

  expect(messages.length).toBe(1);
  const message = JSON.parse(messages[0].data);
  expect(message.messageId).toBe(1);
  expect(message.error.message).toBe("Action not found: unknown");
  expect(message.error.type).toBe("CONNECTION_ACTION_NOT_FOUND");
  socket.close();
});
