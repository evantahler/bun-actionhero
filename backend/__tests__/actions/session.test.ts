import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { api, type ActionResponse } from "../../api";
import { config } from "../../config";
import { users } from "../../schema/users";
import { hashPassword } from "../../ops/UserOps";
import type { SessionCreate } from "../../actions/session";

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
        password: "xxx",
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
        password: "yoshi",
      }),
    });
    const response = (await res.json()) as ActionResponse<SessionCreate>;
    expect(res.status).toBe(500);
    expect(response.error?.message).toEqual("Password does not match");
  });
});
