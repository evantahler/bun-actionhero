import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { MessageCrete, MessagesList } from "../../actions/message";
import type { SessionCreate } from "../../actions/session";
import { api, type ActionResponse } from "../../api";
import { config } from "../../config";
import { messages } from "../../schema/messages";
import "./../setup";

const url = config.server.web.applicationUrl;

beforeAll(async () => {
  await api.start();
  await api.db.clearDatabase();
  await api.redis.redis.flushdb();
});

afterAll(async () => {
  await api.stop();
});

describe("message:create", () => {
  let user: ActionResponse<SessionCreate>["user"];
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
    user = sessionResponse.user;
    session = sessionResponse.session;
  });

  test("fails without a session", async () => {
    const res = await fetch(url + "/api/message", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Hello, world!" }),
    });
    expect(res.status).toBe(401);
    const response = (await res.json()) as ActionResponse<MessageCrete>;
    expect(response.error?.message).toEqual("Session not found");
  });

  test("fails without a valid session", async () => {
    const res = await fetch(url + "/api/message", {
      method: "PUT",
      headers: {
        Cookie: `${session.cookieName}=123`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: "Hello, world!" }),
    });
    expect(res.status).toBe(401);
    const response = (await res.json()) as ActionResponse<MessageCrete>;
    expect(response.error?.message).toEqual("Session not found");
  });

  test("messages can be created", async () => {
    const res = await fetch(url + "/api/message", {
      method: "PUT",
      headers: {
        Cookie: `${session.cookieName}=${session.id}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: "Hello, world!" }),
    });
    expect(res.status).toBe(200);

    const response = (await res.json()) as ActionResponse<MessageCrete>;
    expect(response.message.body).toEqual("Hello, world!");
    expect(response.message.id).toBeGreaterThanOrEqual(1);
    expect(response.message.createdAt).toBeGreaterThan(0);
  });

  describe("messages:list", () => {
    beforeAll(async () => {
      await api.db.db.delete(messages);

      for (const m of [
        "message 1",
        "message 2",
        "message 3",
        "message 4",
        "message 5",
      ]) {
        await api.db.db.insert(messages).values({
          body: m,
          user_id: user.id,
        });
      }
    });

    test("messages can be listed in the proper (reverse) order", async () => {
      const res = await fetch(url + "/api/messages/list", {
        method: "GET",
        headers: {
          Cookie: `${session.cookieName}=${session.id}`,
          "Content-Type": "application/json",
        },
      });
      expect(res.status).toBe(200);

      const response = (await res.json()) as ActionResponse<MessagesList>;
      expect(response.messages.length).toEqual(5);
      expect(response.messages[0].body).toEqual("message 5");
      expect(response.messages[4].body).toEqual("message 1");
    });

    test("limit and offset can be used", async () => {
      const res = await fetch(url + "/api/messages/list?limit=2&offset=2", {
        method: "GET",
        headers: {
          Cookie: `${session.cookieName}=${session.id}`,
          "Content-Type": "application/json",
        },
      });
      expect(res.status).toBe(200);

      const response = (await res.json()) as ActionResponse<MessagesList>;
      expect(response.messages.length).toEqual(2);
      expect(response.messages[0].body).toEqual("message 3");
      expect(response.messages[1].body).toEqual("message 2");
    });
  });
});
