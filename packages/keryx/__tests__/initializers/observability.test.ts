import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { api } from "../../api";
import { HOOK_TIMEOUT } from "../setup";

beforeAll(async () => {
  await api.initialize();
  await api.start();
}, HOOK_TIMEOUT);

afterAll(async () => {
  await api.stop();
}, HOOK_TIMEOUT);

describe("observability no-op stub (without plugin)", () => {
  test("api.observability is defined with no-op defaults", () => {
    expect(api.observability).toBeDefined();
    expect(api.observability.enabled).toBe(false);
    expect(api.observability.tracing.enabled).toBe(false);
  });

  test("no-op metric instruments do not throw", () => {
    expect(() => api.observability.http.requestsTotal.add(1)).not.toThrow();
    expect(() =>
      api.observability.http.requestDuration.record(100),
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

  test("collectMetrics() returns empty string without plugin", async () => {
    const result = await api.observability.collectMetrics();
    expect(result).toBe("");
  });

  test("tracing no-ops return safe values", () => {
    const ctx = api.observability.tracing.extractContext(new Headers());
    expect(ctx).toBeDefined();
    // injectContext should not throw
    expect(() =>
      api.observability.tracing.injectContext({ key: "value" }),
    ).not.toThrow();
    // no-op tracer should return a span that doesn't throw
    const span = api.observability.tracing.tracer.startSpan("test");
    expect(span).toBeDefined();
    expect(() => span.end()).not.toThrow();
  });
});
