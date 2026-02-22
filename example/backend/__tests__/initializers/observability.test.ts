import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { api, config } from "keryx";
import { HOOK_TIMEOUT, serverUrl } from "../setup";

beforeAll(async () => {
  config.observability.enabled = true;
  await api.start();
}, HOOK_TIMEOUT);

afterAll(async () => {
  await api.stop();
  config.observability.enabled = false;
}, HOOK_TIMEOUT);

describe("observability", () => {
  test("api.observability namespace exists and is enabled", () => {
    expect(api.observability).toBeDefined();
    expect(api.observability.enabled).toBe(true);
  });

  test("collectMetrics returns prometheus text format", async () => {
    const metrics = await api.observability.collectMetrics();
    expect(typeof metrics).toBe("string");
    expect(metrics).toContain("keryx_system_connections");
  });

  test("action execution records metrics", async () => {
    const url = serverUrl();
    const res = await fetch(`${url}/api/status`);
    expect(res.status).toBe(200);

    await Bun.sleep(50);

    const metrics = await api.observability.collectMetrics();
    expect(metrics).toContain("keryx_action_executions");
    expect(metrics).toContain("keryx_action_duration");
    expect(metrics).toContain("keryx_http_requests");
    expect(metrics).toContain("keryx_http_request_duration");
  });

  test("/metrics endpoint returns prometheus text", async () => {
    const url = serverUrl();

    await fetch(`${url}/api/status`);

    const res = await fetch(`${url}${config.observability.metricsRoute}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");

    const body = await res.text();
    expect(body).toContain("keryx_action_executions");
    expect(body).toContain("keryx_http_requests");
    expect(body).toContain("keryx_system_connections");
  });

  test("metrics include action name attributes", async () => {
    const url = serverUrl();
    await fetch(`${url}/api/status`);
    await Bun.sleep(50);

    const metrics = await api.observability.collectMetrics();
    expect(metrics).toContain("status");
    expect(metrics).toContain("success");
  });

  test("/metrics endpoint is not counted as an action request", async () => {
    const url = serverUrl();

    await fetch(`${url}${config.observability.metricsRoute}`);
    await fetch(`${url}${config.observability.metricsRoute}`);

    const after = await api.observability.collectMetrics();
    expect(after).toContain("keryx_http_requests");
  });
});
