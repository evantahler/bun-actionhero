import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { api } from "../../api";

beforeAll(async () => {
  await api.initialize();
});

afterAll(async () => {
  await api.stop();
});

test("the server process is set", async () => {
  expect(api.name.name).toEqual("test-server");
  expect(api.name.pid).toBeGreaterThan(0);
});
