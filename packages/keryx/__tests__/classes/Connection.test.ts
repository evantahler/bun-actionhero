import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Connection, api, logger } from "../../api";
import { ErrorType } from "../../classes/TypedError";
import { HOOK_TIMEOUT } from "./../setup";

beforeAll(async () => {
  await api.start();
  await api.db.clearDatabase();
  await api.redis.redis.flushdb();
}, HOOK_TIMEOUT);

afterAll(async () => {
  await api.stop();
}, HOOK_TIMEOUT);

describe("Connection class", () => {
  test("constructor creates connection with unique ID", () => {
    const conn1 = new Connection("test", "identifier-1");
    const conn2 = new Connection("test", "identifier-2");

    expect(conn1.id).toBeDefined();
    expect(conn2.id).toBeDefined();
    expect(conn1.id).not.toBe(conn2.id);
  });

  test("constructor accepts custom ID", () => {
    const customId = "custom-test-id";
    const conn = new Connection("test", "identifier", customId);

    expect(conn.id).toBe(customId);
  });

  test("constructor sets type and identifier", () => {
    const conn = new Connection("websocket", "ws-client-123");

    expect(conn.type).toBe("websocket");
    expect(conn.identifier).toBe("ws-client-123");
  });

  test("connection is added to api.connections map", () => {
    const initialCount = api.connections.connections.size;
    const conn = new Connection("test", "test-added");

    expect(api.connections.connections.size).toBe(initialCount + 1);
    expect(api.connections.connections.get(conn.id)).toBe(conn);
  });

  test("subscriptions set is initialized empty", () => {
    const conn = new Connection("test", "test-subs");

    expect(conn.subscriptions).toBeDefined();
    expect(conn.subscriptions instanceof Set).toBe(true);
    expect(conn.subscriptions.size).toBe(0);
  });

  test("sessionLoaded flag starts as false", () => {
    const conn = new Connection("test", "test-session-flag");

    expect(conn.sessionLoaded).toBe(false);
  });

  test("rawConnection can be provided", () => {
    const rawConn = { socket: "test-socket" };
    const conn = new Connection("test", "test-raw", undefined, rawConn);

    expect(conn.rawConnection).toBe(rawConn);
  });

  test("act executes status action successfully", async () => {
    const conn = new Connection("test", "test-act-status");
    const params = new FormData();

    const { response, error } = await conn.act("status", params);

    expect(error).toBeUndefined();
    expect(response).toBeDefined();
    expect(response).toHaveProperty("name");
    expect(response).toHaveProperty("pid");
    expect(response).toHaveProperty("version");
  });

  test("act returns error for non-existent action", async () => {
    const conn = new Connection("test", "test-act-notfound");
    const params = new FormData();

    const { response: _response, error } = await conn.act(
      "nonexistent-action",
      params,
    );

    expect(error).toBeDefined();
    expect(error?.type).toBe(ErrorType.CONNECTION_ACTION_NOT_FOUND);
    expect(error?.message).toContain("Action not found");
  });

  test("act returns error for undefined action name", async () => {
    const conn = new Connection("test", "test-act-undefined");
    const params = new FormData();

    const { response: _response, error } = await conn.act(undefined, params);

    expect(error).toBeDefined();
    expect(error?.type).toBe(ErrorType.CONNECTION_ACTION_NOT_FOUND);
  });

  test("act handles action with invalid parameters", async () => {
    const conn = new Connection("test", "test-act-invalid-params");
    const params = new FormData();
    // user:create requires name, email, password - we're not providing them

    const { response: _response, error } = await conn.act(
      "user:create",
      params,
    );

    expect(error).toBeDefined();
    // Should be a validation error
    expect(error?.message).toBeDefined();
  });

  test("act logs the connection type (trigger source)", async () => {
    const logMessages: string[] = [];
    const originalInfo = logger.info;
    logger.info = (message: string) => {
      logMessages.push(message);
    };

    try {
      for (const type of ["web", "cli", "resque", "websocket"]) {
        logMessages.length = 0;
        const conn = new Connection(type, `test-${type}`);
        const params = new FormData();
        await conn.act("status", params);

        const actionLog = logMessages.find(
          (msg) => msg.includes("[ACTION:") && msg.includes("status"),
        );
        expect(actionLog).toBeDefined();
        expect(actionLog).toContain(`[ACTION:${type.toUpperCase()}:OK]`);
      }
    } finally {
      logger.info = originalInfo;
    }
  });

  test("act loads session for connection", async () => {
    const conn = new Connection("test", "test-session-load");

    // Create a session
    await api.session.create(conn, { userId: 999 });

    // Act should load the session
    const params = new FormData();
    await conn.act("status", params);

    // Session should be loaded
    expect(conn.session).toBeDefined();
    expect(conn.session?.data.userId).toBe(999);
  });

  test("subscribe adds room to subscriptions", () => {
    const conn = new Connection("test", "test-subscribe");

    conn.subscribe("room1");
    conn.subscribe("room2");

    expect(conn.subscriptions.has("room1")).toBe(true);
    expect(conn.subscriptions.has("room2")).toBe(true);
    expect(conn.subscriptions.size).toBe(2);
  });

  test("unsubscribe removes room from subscriptions", () => {
    const conn = new Connection("test", "test-unsubscribe");

    conn.subscribe("room1");
    conn.subscribe("room2");
    conn.unsubscribe("room1");

    expect(conn.subscriptions.has("room1")).toBe(false);
    expect(conn.subscriptions.has("room2")).toBe(true);
    expect(conn.subscriptions.size).toBe(1);
  });

  test("unsubscribe handles non-existent room gracefully", () => {
    const conn = new Connection("test", "test-unsub-nonexistent");

    // Should not throw
    conn.unsubscribe("non-existent-room");

    expect(conn.subscriptions.size).toBe(0);
  });

  test("connection can subscribe to multiple rooms", () => {
    const conn = new Connection("test", "test-multi-subscribe");

    const rooms = ["room1", "room2", "room3", "room4", "room5"];
    rooms.forEach((room) => conn.subscribe(room));

    expect(conn.subscriptions.size).toBe(5);
    rooms.forEach((room) => {
      expect(conn.subscriptions.has(room)).toBe(true);
    });
  });

  test("subscribing to same room multiple times only adds once", () => {
    const conn = new Connection("test", "test-duplicate-subscribe");

    conn.subscribe("duplicate-room");
    conn.subscribe("duplicate-room");
    conn.subscribe("duplicate-room");

    expect(conn.subscriptions.size).toBe(1);
    expect(conn.subscriptions.has("duplicate-room")).toBe(true);
  });

  test("connection without session has no session property", () => {
    const conn = new Connection("test", "test-no-session");

    expect(conn.session).toBeUndefined();
  });
});
