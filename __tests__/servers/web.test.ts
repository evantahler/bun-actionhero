import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { api, config, type ActionResponse } from "../../api";
import type { Status } from "../../actions/status";

const url = `http://${config.server.web.host}:${config.server.web.port}`;

beforeAll(async () => {
  await api.start();
});

afterAll(async () => {
  await api.stop();
});

test("the web server will boot on a test port", async () => {
  expect(url).toContain(":80"); // the port will be dynamic
});

describe("actions", () => {
  test("the web server can handle a request to an action", async () => {
    const res = await fetch(url + "/api/status");
    expect(res.status).toBe(200);
    const response = (await res.json()) as ActionResponse<Status>;
    expect(response.name).toInclude("test-server");
  });

  test("trying for a non-existent action returns a 404", async () => {
    const res = await fetch(url + "/api/non-existent-action");
    expect(res.status).toBe(404);
    const response = (await res.json()) as ActionResponse<Status>;
    expect(response.error?.error).toContain("Action not found");
    expect(response.error?.stack).toContain("/bun-api-template/");
  });
});

describe("assets", () => {});

describe("pages", () => {});
