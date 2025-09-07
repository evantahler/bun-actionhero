import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { api, config } from "../../api";
import "./../setup";

const wsUrl = config.server.web.applicationUrl
  .replace("https://", "wss://")
  .replace("http://", "ws://");

beforeAll(async () => {
  await api.start();
  await api.db.clearDatabase();
});

afterAll(async () => {
  await api.stop();
});

const buildWebSocket = async () => {
  const socket = new WebSocket(wsUrl);
  const messages: MessageEvent[] = [];
  socket.addEventListener("message", (event) => {
    messages.push(event);
  });
  socket.addEventListener("error", (event) => {
    console.error(event);
  });
  await new Promise((resolve) => {
    socket.addEventListener("open", resolve);
  });
  return { socket, messages };
};

describe("actions", () => {
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

  describe("chat", () => {
    test("integration-test", async () => {
      const { socket: socket1, messages: messages1 } = await buildWebSocket();
      const { socket: socket2, messages: messages2 } = await buildWebSocket();

      socket1.send(
        JSON.stringify({
          messageType: "action",
          action: "user:create",
          messageId: 1,
          params: {
            name: "Marco",
            email: "marco@example.com",
            password: "abc12345",
          },
        }),
      );

      socket2.send(
        JSON.stringify({
          messageType: "action",
          action: "user:create",
          messageId: 1,
          params: {
            name: "Polo",
            email: "polo@example.com",
            password: "abc12345",
          },
        }),
      );

      while (messages1.length < 1 || messages2.length < 1) {
        await Bun.sleep(10);
      }

      const socket1UserId = JSON.parse(messages1[0].data).response.user.id;
      const socket2UserId = JSON.parse(messages2[0].data).response.user.id;
      expect(socket1UserId).toBeGreaterThan(0);
      expect(socket2UserId).toBeGreaterThan(0);
      expect(socket1UserId).not.toBe(socket2UserId);
      expect(JSON.parse(messages1[0].data).response.user.email).toBe(
        "marco@example.com",
      );
      expect(JSON.parse(messages2[0].data).response.user.email).toBe(
        "polo@example.com",
      );

      socket1.send(
        JSON.stringify({
          messageType: "action",
          action: "session:create",
          messageId: 2,
          params: {
            email: "marco@example.com",
            password: "abc12345",
          },
        }),
      );

      socket2.send(
        JSON.stringify({
          messageType: "action",
          action: "session:create",
          messageId: 2,
          params: {
            email: "polo@example.com",
            password: "abc12345",
          },
        }),
      );

      while (messages1.length < 2 || messages2.length < 2) {
        await Bun.sleep(10);
      }

      const sessionMessage1 = JSON.parse(messages1[1].data);
      const sessionMessage2 = JSON.parse(messages2[1].data);

      expect(sessionMessage1.response.user.id).toEqual(1);
      expect(sessionMessage1.response.user.email).toEqual("marco@example.com");
      expect(sessionMessage1.response.session.data.userId).toEqual(1);
      expect(sessionMessage2.response.user.id).toEqual(2);
      expect(sessionMessage2.response.user.email).toEqual("polo@example.com");
      expect(sessionMessage2.response.session.data.userId).toEqual(2);

      socket1.send(
        JSON.stringify({ messageType: "subscribe", channel: "messages" }),
      );
      socket2.send(
        JSON.stringify({ messageType: "subscribe", channel: "messages" }),
      );

      while (messages1.length < 3 || messages2.length < 3) {
        await Bun.sleep(10);
      }

      const subscribeMessage1 = JSON.parse(messages1[2].data);
      const subscribeMessage2 = JSON.parse(messages2[2].data);

      expect(subscribeMessage1).toEqual({
        subscribed: { channel: "messages" },
      });
      expect(subscribeMessage2).toEqual({
        subscribed: { channel: "messages" },
      });

      socket1.send(
        JSON.stringify({
          messageType: "action",
          action: "message:create",
          messageId: "A",
          params: { body: "Marco" },
        }),
      );

      while (messages1.length < 5 || messages2.length < 4) {
        await Bun.sleep(10);
      }

      socket2.send(
        JSON.stringify({
          messageType: "action",
          action: "message:create",
          messageId: "B",
          params: { body: "Polo" },
        }),
      );

      while (messages1.length < 6 || messages2.length < 6) {
        await Bun.sleep(10);
      }

      // messages may arrive out of order
      let receivedMessages1: Record<string, any>[] = [];
      let receivedMessages2: Record<string, any>[] = [];

      for (const message of messages1.slice(3)) {
        const parsedMessage = JSON.parse(message.data);
        if (!parsedMessage.messageId) receivedMessages1.push(parsedMessage);
      }

      for (const message of messages2.slice(3)) {
        const parsedMessage = JSON.parse(message.data);
        if (!parsedMessage.messageId) receivedMessages2.push(parsedMessage);
      }

      expect(receivedMessages1.length).toEqual(2);
      expect(receivedMessages2.length).toEqual(2);

      expect(receivedMessages1[0].message.message.message.body).toEqual(
        "Marco",
      );
      expect(receivedMessages2[0].message.message.message.body).toEqual(
        "Marco",
      );
      expect(receivedMessages1[1].message.message.message.body).toEqual("Polo");
      expect(receivedMessages2[1].message.message.message.body).toEqual("Polo");

      socket1.close();
      socket2.close();
    });
  });
});
