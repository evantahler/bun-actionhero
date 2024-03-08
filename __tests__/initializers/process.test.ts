import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import { api } from "../../api";

beforeAll(async () => {
  await api.initialize();
});

afterAll(async () => {
  await api.stop();
});

test("the server process is set", async () => {
  expect(api.process.name).toEqual("test-server");
  expect(api.process.pid).toBeGreaterThan(0);
});
