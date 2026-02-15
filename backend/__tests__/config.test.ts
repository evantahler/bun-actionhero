import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { config, loadFromEnvIfSet } from "../api";
import "./setup";

test("config can be loaded", () => {
  expect(config).toBeDefined();
});

test("config can have sub-parts", () => {
  expect(typeof config.server.web.port).toBe("number");
  expect(config.server.web.port).toBeGreaterThanOrEqual(0);
});

test("config maintains types", () => {
  expect(typeof config.server.web.port).toBe("number");
  expect(typeof config.server.web.host).toBe("string");
});

describe("updating config", () => {
  let originalPort: number;
  beforeAll(() => {
    originalPort = config.server.web.port;
  });

  afterAll(() => {
    config.server.web.port = originalPort;
  });

  test("config can be overridden by environment variables", async () => {
    expect(await loadFromEnvIfSet("servers.web.port", 8081)).toEqual(8081);

    Bun.env["WEB_SERVER_PORT_TEST"] = "8081";
    expect(await loadFromEnvIfSet("servers.web.port", 8081)).toEqual(8081);
  });

  test("parsing works for various types", async () => {
    const scenarios = [
      1,
      0,
      -1,
      1.1,
      -1.1,
      "a",
      "1",
      true,
      false,
      "true",
      "false",
    ];

    for (const v of scenarios) {
      Bun.env["foo"] = v.toString();
      const output = await loadFromEnvIfSet("foo", v);
      expect(output).toEqual(v);
    }
  });
});
