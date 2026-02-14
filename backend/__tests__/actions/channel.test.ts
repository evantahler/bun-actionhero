import { api, config, type ActionResponse } from "bun-actionhero";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import type { ChannelMembers } from "../../actions/channel";
import type { SessionCreate } from "../../actions/session";
import {
  buildWebSocket,
  createSession,
  createUser,
  subscribeToChannel,
} from "./../servers/websocket-helpers";
import { HOOK_TIMEOUT } from "./../setup";

const url = config.server.web.applicationUrl;

beforeAll(async () => {
  await api.start();
  await api.db.clearDatabase();
  await api.redis.redis.flushdb();
}, HOOK_TIMEOUT);

afterAll(async () => {
  await api.stop();
}, HOOK_TIMEOUT);

describe("channel:members", () => {
  let session: ActionResponse<SessionCreate>["session"];

  beforeAll(async () => {
    await fetch(url + "/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Mario Mario",
        email: "mario@example.com",
        password: "mushroom1",
      }),
    });

    const sessionRes = await fetch(url + "/api/session", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "mario@example.com",
        password: "mushroom1",
      }),
    });
    const sessionResponse =
      (await sessionRes.json()) as ActionResponse<SessionCreate>;
    session = sessionResponse.session;
  });

  beforeEach(async () => {
    // Clear any leftover presence data
    api.channels.members("messages"); // no-op, just ensures channel initializer is ready
  });

  test("fails without a session", async () => {
    const res = await fetch(url + "/api/channel/messages/members", {
      method: "GET",
    });
    expect(res.status).toBe(401);
    const response = (await res.json()) as ActionResponse<ChannelMembers>;
    expect(response.error?.message).toEqual("Session not found");
  });

  test("returns empty members for a channel with no subscribers", async () => {
    const res = await fetch(url + "/api/channel/some-empty-channel/members", {
      method: "GET",
      headers: {
        Cookie: `${session.cookieName}=${session.id}`,
      },
    });
    expect(res.status).toBe(200);
    const response = (await res.json()) as ActionResponse<ChannelMembers>;
    expect(response.members).toEqual([]);
  });

  test("returns members after a WebSocket client subscribes", async () => {
    const { socket, messages } = await buildWebSocket();

    await createUser(
      socket,
      messages,
      "Luigi",
      "luigi@example.com",
      "mushroom1",
    );
    await createSession(socket, messages, "luigi@example.com", "mushroom1");
    await subscribeToChannel(socket, messages, "messages");

    const res = await fetch(url + "/api/channel/messages/members", {
      method: "GET",
      headers: {
        Cookie: `${session.cookieName}=${session.id}`,
      },
    });
    expect(res.status).toBe(200);
    const response = (await res.json()) as ActionResponse<ChannelMembers>;
    expect(response.members.length).toBeGreaterThanOrEqual(1);

    socket.close();
    await Bun.sleep(100);
  });

  test("member is removed after disconnect", async () => {
    const { socket, messages } = await buildWebSocket();

    await createUser(socket, messages, "Toad", "toad@example.com", "mushroom1");
    await createSession(socket, messages, "toad@example.com", "mushroom1");
    await subscribeToChannel(socket, messages, "test-channel");

    // Verify member is present
    let res = await fetch(url + "/api/channel/test-channel/members", {
      method: "GET",
      headers: {
        Cookie: `${session.cookieName}=${session.id}`,
      },
    });
    let response = (await res.json()) as ActionResponse<ChannelMembers>;
    expect(response.members.length).toBe(1);

    // Disconnect
    socket.close();
    await Bun.sleep(100);

    // Verify member is removed
    res = await fetch(url + "/api/channel/test-channel/members", {
      method: "GET",
      headers: {
        Cookie: `${session.cookieName}=${session.id}`,
      },
    });
    response = (await res.json()) as ActionResponse<ChannelMembers>;
    expect(response.members).toEqual([]);
  });
});
