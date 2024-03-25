import { test, expect, beforeAll, afterAll } from "bun:test";
import { api, type ActionResponse } from "../../api";
import type { UserCreate } from "../../actions/user";
import { config } from "../../config";

const url = `http://${config.server.web.host}:${config.server.web.port}`;

beforeAll(async () => {
  await api.start();
});

afterAll(async () => {
  await api.stop();
});

test("user can be created", async () => {
  const res = await fetch(url + "/api/user", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "person 1",
      email: "person1@example.com",
      password: "password",
    }),
  });
  const response = (await res.json()) as ActionResponse<UserCreate>;
  expect(res.status).toBe(200);

  expect(response.id).toEqual(1);
  expect(response.email).toEqual("person1@example.com");
});
