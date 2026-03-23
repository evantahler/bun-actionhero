import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { api, config } from "keryx";
import { observabilityPlugin } from "..";
import { HOOK_TIMEOUT, serverUrl } from "./setup";

beforeAll(async () => {
  config.plugins = [observabilityPlugin];
  config.observability.enabled = true;
  await api.initialize();
  await api.start();
}, HOOK_TIMEOUT);

afterAll(async () => {
  await api.stop();
  config.observability.enabled = false;
  config.plugins = [];
}, HOOK_TIMEOUT);

describe("observability plugin", () => {
  test("api.observability.enabled is true after start()", () => {
    expect(api.observability.enabled).toBe(true);
  });

  test("api.observability.tracing.enabled is false (tracing not enabled by default)", () => {
    expect(api.observability.tracing.enabled).toBe(false);
  });

  test("GET /metrics returns Prometheus text", async () => {
    const url = serverUrl();
    const res = await fetch(`${url}/metrics`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("# HELP");
    expect(body).toContain("# TYPE");
  });

  test("metric instruments do not throw when recording values", () => {
    expect(() =>
      api.observability.http.requestsTotal.add(1, { method: "GET" }),
    ).not.toThrow();
    expect(() =>
      api.observability.http.requestDuration.record(42),
    ).not.toThrow();
    expect(() => api.observability.http.activeConnections.add(1)).not.toThrow();
    expect(() => api.observability.ws.connections.add(1)).not.toThrow();
    expect(() => api.observability.ws.messagesTotal.add(1)).not.toThrow();
    expect(() => api.observability.action.executionsTotal.add(1)).not.toThrow();
    expect(() => api.observability.action.duration.record(10)).not.toThrow();
    expect(() => api.observability.task.enqueuedTotal.add(1)).not.toThrow();
    expect(() => api.observability.task.executedTotal.add(1)).not.toThrow();
    expect(() => api.observability.task.duration.record(10)).not.toThrow();
  });

  test("collectMetrics() returns non-empty Prometheus text", async () => {
    const result = await api.observability.collectMetrics();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("tracing no-ops return safe values when tracing is disabled", () => {
    const ctx = api.observability.tracing.extractContext(new Headers());
    expect(ctx).toBeDefined();
    expect(() => api.observability.tracing.injectContext({})).not.toThrow();
    const span = api.observability.tracing.tracer.startSpan("test");
    expect(span).toBeDefined();
    expect(() => span.end()).not.toThrow();
  });
});
