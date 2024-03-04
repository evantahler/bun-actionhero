import {
  test,
  expect,
  describe,
  beforeAll,
  beforeEach,
  afterAll,
} from "bun:test";

import { config } from "../config";
import { loadFromEnvIfSet } from "../util/config";

test("config can be loaded", () => {
  expect(config).toBeDefined();
});

test("config can have sub-parts", () => {
  expect(typeof config.server.web.port).toBe("number");
  expect(config.server.web.port).toEqual(8080);
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

  test("config can be overridden by environment variables", () => {
    expect(loadFromEnvIfSet("servers.web.port", 8080)).toEqual(8080);

    Bun.env["servers.web.port"] = "8081";
    expect(loadFromEnvIfSet("servers.web.port", 8080)).toEqual(8081);
  });
});
