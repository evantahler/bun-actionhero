import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { SessionCreate } from "../../actions/session";
import { api, type ActionResponse } from "../../api";
import { config } from "../../config";
import { hashPassword } from "../../ops/UserOps";
import { users } from "../../schema/users";
import "./../setup";

const url = config.server.web.applicationUrl;

beforeAll(async () => {
  await api.start();
  await api.db.clearDatabase();
  await api.db.db.insert(users).values({
    name: "Mario Mario",
    email: "mario@example.com",
    password_hash: await hashPassword("mushroom1"),
  });
});

afterAll(async () => {
  await api.stop();
});

describe("session:create", () => {
  test("returns user when matched", async () => {
    const res = await fetch(url + "/api/session", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "mario@example.com",
        password: "mushroom1",
      }),
    });
    const response = (await res.json()) as ActionResponse<SessionCreate>;
    expect(res.status).toBe(200);

    expect(response.user.id).toEqual(1);
    expect(response.user.name).toEqual("Mario Mario");
    expect(response.session.createdAt).toBeGreaterThan(0);
    expect(response.session.data.userId).toEqual(response.user.id);
  });

  test("fails validation", async () => {
    const res = await fetch(url + "/api/session", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "foo",
        password: "xxx",
      }),
    });
    const response = (await res.json()) as ActionResponse<SessionCreate>;
    expect(res.status).toBe(406);
    expect(response.error?.message).toEqual("This is not a valid email");
  });

  test("fails when users is not found", async () => {
    const res = await fetch(url + "/api/session", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "bowser@example.com",
        password: "password123",
      }),
    });
    const response = (await res.json()) as ActionResponse<SessionCreate>;
    expect(res.status).toBe(500);
    expect(response.error?.message).toEqual("User not found");
  });

  test("fails when passwords do not match", async () => {
    const res = await fetch(url + "/api/session", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "mario@example.com",
        password: "wrongpassword123",
      }),
    });
    const response = (await res.json()) as ActionResponse<SessionCreate>;
    expect(res.status).toBe(500);
    expect(response.error?.message).toEqual("Password does not match");
  });
});

describe("session:destroy", () => {
  let session: ActionResponse<SessionCreate>["session"];

  beforeAll(async () => {
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

  test("successfully destroys a session", async () => {
    const res = await fetch(url + "/api/session", {
      method: "DELETE",
      headers: {
        Cookie: `${session.cookieName}=${session.id}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const response = await res.json();
    expect(res.status).toBe(200);
    expect(response.success).toBe(true);

    // Verify session is actually destroyed by trying to access a protected endpoint
    const userRes = await fetch(url + "/api/user", {
      method: "GET",
      headers: {
        Cookie: `${session.cookieName}=${session.id}`,
        "Content-Type": "application/json",
      },
    });
    expect(userRes.status).toBe(401);
  });

  test("fails without a session", async () => {
    const res = await fetch(url + "/api/session", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const response = await res.json();
    expect(res.status).toBe(401);
    expect(response.error?.message).toMatch(/Session not found/);
  });
});
