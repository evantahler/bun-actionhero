import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { api } from "../../api";
import { Connection } from "../../classes/Connection";
import { ErrorType, TypedError } from "../../classes/TypedError";
import { config } from "../../config";
import {
  checkRateLimit,
  RateLimitMiddleware,
  type RateLimitInfo,
} from "../../middleware/rateLimit";
import { HOOK_TIMEOUT } from "../setup";

const url = config.server.web.applicationUrl;

beforeAll(async () => {
  await api.start();
  await api.db.clearDatabase();
}, HOOK_TIMEOUT);

afterAll(async () => {
  await api.stop();
}, HOOK_TIMEOUT);

beforeEach(async () => {
  // Clear all rate limit keys
  const keys = await api.redis.redis.keys(`${config.rateLimit.keyPrefix}:*`);
  if (keys.length > 0) await api.redis.redis.del(...keys);
});

describe("RateLimitMiddleware", () => {
  describe("runBefore", () => {
    test("allows requests under the limit", async () => {
      const connection = new Connection("test", "10.0.0.1");
      connection.session = undefined;

      const result = await RateLimitMiddleware.runBefore!({}, connection);
      expect(result).toBeUndefined();

      const info = (connection as any).rateLimitInfo as RateLimitInfo;
      expect(info).toBeDefined();
      expect(info.limit).toBe(config.rateLimit.unauthenticatedLimit);
      expect(info.remaining).toBeLessThan(info.limit);
      expect(info.retryAfter).toBeUndefined();

      connection.destroy();
    });

    test("throws TypedError when rate limit exceeded", async () => {
      const identifier = "ip:10.0.0.2";
      const limit = config.rateLimit.unauthenticatedLimit;

      // Exhaust the rate limit
      const pipeline = api.redis.redis.pipeline();
      const windowMs = config.rateLimit.windowMs;
      const currentWindow = Math.floor(Date.now() / windowMs);
      const key = `${config.rateLimit.keyPrefix}:${identifier}:${currentWindow}`;
      pipeline.set(key, String(limit + 10));
      pipeline.expire(key, 120);
      await pipeline.exec();

      const connection = new Connection("test", "10.0.0.2");
      connection.session = undefined;

      try {
        await RateLimitMiddleware.runBefore!({}, connection);
        expect(true).toBe(false); // Should not reach here
      } catch (e) {
        expect(e).toBeInstanceOf(TypedError);
        expect((e as TypedError).type).toBe(ErrorType.CONNECTION_RATE_LIMITED);
        expect((e as TypedError).message).toContain("Rate limit exceeded");
      }

      connection.destroy();
    });

    test("authenticated users get the authenticated limit", async () => {
      // Temporarily set different limits to verify the correct one is chosen
      const origUnauth = config.rateLimit.unauthenticatedLimit;
      const origAuth = config.rateLimit.authenticatedLimit;
      (config.rateLimit as any).unauthenticatedLimit = 5;
      (config.rateLimit as any).authenticatedLimit = 50;

      try {
        const unauthConn = new Connection("test", "10.0.0.30");
        unauthConn.session = undefined;
        await RateLimitMiddleware.runBefore!({}, unauthConn);
        const unauthInfo = (unauthConn as any).rateLimitInfo as RateLimitInfo;
        expect(unauthInfo.limit).toBe(5);
        unauthConn.destroy();

        const authConn = new Connection("test", "10.0.0.31");
        authConn.session = {
          id: "test-session",
          cookieName: "sessionId",
          createdAt: Date.now(),
          data: { userId: 42 },
        };
        await RateLimitMiddleware.runBefore!({}, authConn);
        const authInfo = (authConn as any).rateLimitInfo as RateLimitInfo;
        expect(authInfo.limit).toBe(50);
        expect(authInfo.limit).toBeGreaterThan(unauthInfo.limit);
        authConn.destroy();
      } finally {
        (config.rateLimit as any).unauthenticatedLimit = origUnauth;
        (config.rateLimit as any).authenticatedLimit = origAuth;
      }
    });

    test("does nothing when rate limiting is disabled", async () => {
      const originalEnabled = config.rateLimit.enabled;
      (config.rateLimit as any).enabled = false;

      try {
        const connection = new Connection("test", "10.0.0.4");
        const result = await RateLimitMiddleware.runBefore!({}, connection);
        expect(result).toBeUndefined();
        expect((connection as any).rateLimitInfo).toBeUndefined();
        connection.destroy();
      } finally {
        (config.rateLimit as any).enabled = originalEnabled;
      }
    });
  });

  describe("checkRateLimit", () => {
    test("returns correct info under limit", async () => {
      const info = await checkRateLimit("ip:10.0.0.10", false);
      expect(info.limit).toBe(config.rateLimit.unauthenticatedLimit);
      expect(info.remaining).toBeLessThanOrEqual(info.limit);
      expect(info.remaining).toBeGreaterThanOrEqual(0);
      expect(info.resetAt).toBeGreaterThan(0);
      expect(info.retryAfter).toBeUndefined();
    });

    test("returns retryAfter when over limit", async () => {
      const windowMs = config.rateLimit.windowMs;
      const currentWindow = Math.floor(Date.now() / windowMs);
      const key = `${config.rateLimit.keyPrefix}:ip:10.0.0.11:${currentWindow}`;
      await api.redis.redis.set(
        key,
        String(config.rateLimit.unauthenticatedLimit + 10),
      );

      const info = await checkRateLimit("ip:10.0.0.11", false);
      expect(info.remaining).toBe(0);
      expect(info.retryAfter).toBeDefined();
      expect(info.retryAfter).toBeGreaterThan(0);
    });

    test("different identifiers have independent limits", async () => {
      // Exhaust limit for one IP
      const windowMs = config.rateLimit.windowMs;
      const currentWindow = Math.floor(Date.now() / windowMs);
      const key = `${config.rateLimit.keyPrefix}:ip:10.0.0.12:${currentWindow}`;
      await api.redis.redis.set(
        key,
        String(config.rateLimit.unauthenticatedLimit + 10),
      );

      // Different IP should still be fine
      const info = await checkRateLimit("ip:10.0.0.13", false);
      expect(info.retryAfter).toBeUndefined();

      // Original IP should be limited
      const limitedInfo = await checkRateLimit("ip:10.0.0.12", false);
      expect(limitedInfo.retryAfter).toBeDefined();
    });
  });

  describe("HTTP integration", () => {
    test("rate limit headers are present in responses", async () => {
      const res = await fetch(`${url}/api/status`);
      expect(res.status).toBe(200);
      expect(res.headers.get("X-RateLimit-Limit")).toBeDefined();
      expect(res.headers.get("X-RateLimit-Remaining")).toBeDefined();
      expect(res.headers.get("X-RateLimit-Reset")).toBeDefined();
    });

    test("returns 429 with Retry-After when rate limited", async () => {
      // Exhaust rate limit for a specific identifier in Redis
      const windowMs = config.rateLimit.windowMs;
      const currentWindow = Math.floor(Date.now() / windowMs);
      // Tests connect via localhost/127.0.0.1
      for (const ip of ["ip:::1", "ip:127.0.0.1", "ip:::ffff:127.0.0.1"]) {
        const key = `${config.rateLimit.keyPrefix}:${ip}:${currentWindow}`;
        await api.redis.redis.set(
          key,
          String(config.rateLimit.unauthenticatedLimit + 100),
          "EX",
          120,
        );
      }

      const res = await fetch(`${url}/api/status`);
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBeDefined();

      const body = (await res.json()) as { error: { type: string } };
      expect(body.error.type).toBe("CONNECTION_RATE_LIMITED");
    });
  });
});
