import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Status } from "../../actions/status";
import { api, config, type ActionResponse } from "../../api";
import { HOOK_TIMEOUT, serverUrl } from "./../setup";

let url: string;

beforeAll(async () => {
  await api.start();
  url = serverUrl();
}, HOOK_TIMEOUT);

const staticDir = config.server.web.staticFilesDirectory;

beforeAll(async () => {
  // Ensure the static assets directory exists with a test file
  if (!existsSync(staticDir)) mkdirSync(staticDir, { recursive: true });
  writeFileSync(path.join(staticDir, "test.txt"), "hello static");
});

afterAll(async () => {
  await api.stop();
  // Clean up the test file
  rmSync(path.join(staticDir, "test.txt"), { force: true });
}, HOOK_TIMEOUT);

describe("booting", () => {
  test("the web server will boot on a test port", async () => {
    expect(url).toMatch(/^http:\/\/localhost:\d+$/);
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

describe("security headers", () => {
  test("API responses include security headers", async () => {
    const res = await fetch(url + "/api/status");
    expect(res.headers.get("Content-Security-Policy")).toBe(
      "default-src 'self'",
    );
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
    expect(res.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  test("static file responses include security headers", async () => {
    const res = await fetch(url + "/test.txt");
    expect(res.headers.get("Content-Security-Policy")).toBe(
      "default-src 'self'",
    );
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
    expect(res.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });
});

describe("static files", () => {
  test("serves a file from the static directory", async () => {
    const res = await fetch(url + "/test.txt");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("hello static");
  });

  test("blocks path traversal with ../", async () => {
    const res = await fetch(url + "/../package.json");
    // Should not serve a file outside staticDir — falls through to action routing → 404
    expect(res.status).toBe(404);
  });

  test("blocks encoded path traversal with %2e%2e", async () => {
    const res = await fetch(url + "/%2e%2e/package.json");
    expect(res.status).toBe(404);
  });
});
