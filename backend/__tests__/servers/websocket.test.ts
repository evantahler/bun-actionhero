import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { api, config } from "../../api";
import { HOOK_TIMEOUT } from "./../setup";

const wsUrl = config.server.web.applicationUrl
  .replace("https://", "wss://")
  .replace("http://", "ws://");

beforeAll(async () => {
  await api.start();
  await api.db.clearDatabase();
}, HOOK_TIMEOUT);

afterAll(async () => {
  await api.stop();
}, HOOK_TIMEOUT);

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
    beforeEach(async () => {
      await api.db.clearDatabase();
    });

    // Helper function to create a user via websocket
    const createUser = async (
      socket: WebSocket,
      messages: MessageEvent[],
      name: string,
      email: string,
      password: string,
    ) => {
      socket.send(
        JSON.stringify({
          messageType: "action",
          action: "user:create",
          messageId: 1,
          params: { name, email, password },
        }),
      );

      while (messages.length === 0) await Bun.sleep(10);
      const response = JSON.parse(messages[0].data);

      if (response.error) {
        throw new Error(`User creation failed: ${response.error.message}`);
      }

      return response.response.user;
    };

    // Helper function to create a session via websocket
    const createSession = async (
      socket: WebSocket,
      messages: MessageEvent[],
      email: string,
      password: string,
    ) => {
      socket.send(
        JSON.stringify({
          messageType: "action",
          action: "session:create",
          messageId: 2,
          params: { email, password },
        }),
      );

      while (messages.length < 2) await Bun.sleep(10);
      const response = JSON.parse(messages[1].data);

      if (response.error) {
        throw new Error(`Session creation failed: ${response.error.message}`);
      }

      return response.response;
    };

    // Helper function to subscribe to a channel
    const subscribeToChannel = async (
      socket: WebSocket,
      messages: MessageEvent[],
      channel: string,
    ) => {
      socket.send(JSON.stringify({ messageType: "subscribe", channel }));

      while (messages.length < 3) await Bun.sleep(10);
      const response = JSON.parse(messages[2].data);
      return response;
    };

    // Helper function to wait for messages and filter out action responses
    const waitForBroadcastMessages = async (
      messages: MessageEvent[],
      expectedCount: number,
    ) => {
      await Bun.sleep(100); // Give time for messages to be broadcast

      const broadcastMessages: Record<string, any>[] = [];
      for (const message of messages) {
        const parsedMessage = JSON.parse(message.data);
        if (!parsedMessage.messageId) {
          broadcastMessages.push(parsedMessage);
        }
      }

      try {
        expect(broadcastMessages.length).toBe(expectedCount);
      } catch (e) {
        console.error(JSON.stringify(broadcastMessages, null, 2));
        throw e;
      }
      return broadcastMessages;
    };

    test("should create two users with different IDs", async () => {
      const { socket: socket1, messages: messages1 } = await buildWebSocket();
      const { socket: socket2, messages: messages2 } = await buildWebSocket();

      const user1 = await createUser(
        socket1,
        messages1,
        "Marco",
        "marco@example.com",
        "abc12345",
      );
      const user2 = await createUser(
        socket2,
        messages2,
        "Polo",
        "polo@example.com",
        "abc12345",
      );

      expect(user1.id).toBeGreaterThan(0);
      expect(user2.id).toBeGreaterThan(0);
      expect(user1.id).not.toBe(user2.id);
      expect(user1.email).toBe("marco@example.com");
      expect(user2.email).toBe("polo@example.com");

      socket1.close();
      socket2.close();
    });

    test("should create sessions for both users", async () => {
      const { socket: socket1, messages: messages1 } = await buildWebSocket();
      const { socket: socket2, messages: messages2 } = await buildWebSocket();

      // Create users first
      await createUser(
        socket1,
        messages1,
        "Marco",
        "marco@example.com",
        "abc12345",
      );
      await createUser(
        socket2,
        messages2,
        "Polo",
        "polo@example.com",
        "abc12345",
      );

      // Create sessions
      const session1 = await createSession(
        socket1,
        messages1,
        "marco@example.com",
        "abc12345",
      );
      const session2 = await createSession(
        socket2,
        messages2,
        "polo@example.com",
        "abc12345",
      );

      expect(session1.user.id).toBe(1);
      expect(session1.user.email).toBe("marco@example.com");
      expect(session1.session.data.userId).toBe(1);
      expect(session2.user.id).toBe(2);
      expect(session2.user.email).toBe("polo@example.com");
      expect(session2.session.data.userId).toBe(2);

      socket1.close();
      socket2.close();
    });

    test("should subscribe both users to messages channel", async () => {
      const { socket: socket1, messages: messages1 } = await buildWebSocket();
      const { socket: socket2, messages: messages2 } = await buildWebSocket();

      // Create users and sessions first
      await createUser(
        socket1,
        messages1,
        "Marco",
        "marco@example.com",
        "abc12345",
      );
      await createUser(
        socket2,
        messages2,
        "Polo",
        "polo@example.com",
        "abc12345",
      );
      await createSession(socket1, messages1, "marco@example.com", "abc12345");
      await createSession(socket2, messages2, "polo@example.com", "abc12345");

      // Subscribe to channel
      const subscribe1 = await subscribeToChannel(
        socket1,
        messages1,
        "messages",
      );
      const subscribe2 = await subscribeToChannel(
        socket2,
        messages2,
        "messages",
      );

      expect(subscribe1).toEqual({ subscribed: { channel: "messages" } });
      expect(subscribe2).toEqual({ subscribed: { channel: "messages" } });

      socket1.close();
      socket2.close();
    });

    test.skipIf(Bun.env.GITHUB_ACTIONS === "true")(
      "should broadcast messages to all subscribed users",
      async () => {
        const { socket: socket1, messages: messages1 } = await buildWebSocket();
        const { socket: socket2, messages: messages2 } = await buildWebSocket();

        // Setup: create users, sessions, and subscribe to channel
        await createUser(
          socket1,
          messages1,
          "Marco",
          "marco@example.com",
          "abc12345",
        );
        await createUser(
          socket2,
          messages2,
          "Polo",
          "polo@example.com",
          "abc12345",
        );
        await createSession(
          socket1,
          messages1,
          "marco@example.com",
          "abc12345",
        );
        await createSession(socket2, messages2, "polo@example.com", "abc12345");
        await subscribeToChannel(socket1, messages1, "messages");
        await subscribeToChannel(socket2, messages2, "messages");

        // Clear action response messages
        while (messages1.length > 0) messages1.pop();
        while (messages2.length > 0) messages2.pop();

        // Send messages
        socket1.send(
          JSON.stringify({
            messageType: "action",
            action: "message:create",
            messageId: "A",
            params: { body: "Marco" },
          }),
        );

        socket2.send(
          JSON.stringify({
            messageType: "action",
            action: "message:create",
            messageId: "B",
            params: { body: "Polo" },
          }),
        );

        const broadcastMessages1 = await waitForBroadcastMessages(messages1, 2);
        const broadcastMessages2 = await waitForBroadcastMessages(messages2, 2);

        // Verify both users received both messages
        const messageBodies1 = broadcastMessages1.map(
          (msg) => msg.message.message.message.body,
        );
        const messageBodies2 = broadcastMessages2.map(
          (msg) => msg.message.message.message.body,
        );
        expect(messageBodies1).toEqual(["Marco", "Polo"]);
        expect(messageBodies2).toEqual(["Marco", "Polo"]);

        socket1.close();
        socket2.close();
      },
    );
  });
});
