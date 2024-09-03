import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { api, type ActionResponse } from "../../api";
import type { UserCreate, UserEdit } from "../../actions/user";
import { config } from "../../config";
import type { SessionCreate } from "../../actions/session";

const url = config.server.web.applicationUrl;

beforeAll(async () => {
  await api.start();
  await api.db.clearDatabase();
});

afterAll(async () => {
  await api.stop();
});

describe("user:create", () => {
  test("user can be created", async () => {
    const res = await fetch(url + "/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Mario Mario",
        email: "mario@example.com",
        password: "mushroom1",
      }),
    });
    const response = (await res.json()) as ActionResponse<UserCreate>;
    expect(res.status).toBe(200);

    expect(response.user.id).toEqual(1);
    expect(response.user.email).toEqual("mario@example.com");
  });

  test("email must be unique", async () => {
    const res = await fetch(url + "/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Mario Mario",
        email: "mario@example.com",
        password: "mushroom1",
      }),
    });
    const response = (await res.json()) as ActionResponse<UserCreate>;
    expect(res.status).toBe(500);
    expect(response.error?.message).toMatch(/violates unique constraint/);
  });
});

describe("user:edit", () => {
  test("it fails without a session", async () => {
    const res = await fetch(url + "/api/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "new name" }),
    });
    const response = (await res.json()) as ActionResponse<UserEdit>;
    expect(res.status).toBe(500);
    expect(response.error?.message).toMatch(/User not found/);
  });

  test("the user can be updated", async () => {
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
    expect(sessionRes.status).toBe(200);
    const sessionId = sessionResponse.session.id;

    await Bun.sleep(1001);

    const res = await fetch(url + "/api/user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `${config.session.cookieName}=${sessionId}`,
      },
      body: JSON.stringify({ name: "new name" }),
    });
    const response = (await res.json()) as ActionResponse<UserEdit>;
    expect(res.status).toBe(200);
    expect(response.user.name).toEqual("new name");
    expect(response.user.email).toEqual("mario@example.com");
    expect(sessionResponse.user.updatedAt).toBeLessThan(
      response.user.updatedAt,
    );
  });
});
