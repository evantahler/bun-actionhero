import { test, expect, beforeAll, afterAll } from "bun:test";
import { api, type ActionResponse } from "../../api";
import type { Status } from "../../actions/status";
import { config } from "../../config";

const url = `http://${config.server.web.host}:${config.server.web.port}`;

beforeAll(async () => {
  await api.start();
});

afterAll(async () => {
  await api.stop();
});

test("the web server can handle a request to an action", async () => {
  const res = await fetch(url + "/api/status");
  expect(res.status).toBe(200);
  const response = (await res.json()) as ActionResponse<Status>;

  expect(response.name).toInclude("test-server");
  expect(response.uptime).toBeGreaterThan(0);
  expect(response.consumedMemoryMB).toBeGreaterThan(0);
});
