import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Status } from "../../actions/status";
import { api, config, type ActionResponse } from "../../api";
import { HOOK_TIMEOUT } from "./../setup";

const url = config.server.web.applicationUrl;

beforeAll(async () => {
  await api.start();
}, HOOK_TIMEOUT);

afterAll(async () => {
  await api.stop();
}, HOOK_TIMEOUT);

describe("booting", () => {
  test("the web server will boot on a test port", async () => {
    expect(url).toContain(":80"); // the port will be dynamic
  });
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
    expect(response.error?.message).toContain("Action not found");
    expect(response.error?.stack).toContain("/bun-actionhero/");
  });
});
