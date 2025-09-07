import { afterAll, beforeAll, expect, test } from "bun:test";
import { api } from "../../api";
import "./../setup";

beforeAll(async () => {
  await api.initialize();
});

afterAll(async () => {
  await api.stop();
});

test("the server process is set", async () => {
  expect(api.process.name).toContain("test-server");
  expect(api.process.pid).toBeGreaterThan(0);
});
