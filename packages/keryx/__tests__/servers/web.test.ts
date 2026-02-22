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
    expect(response.error?.stack).toContain("/keryx/");
  });

  test("error responses omit stack when includeStackInErrors is false", async () => {
    const original = config.server.web.includeStackInErrors;
    config.server.web.includeStackInErrors = false;
    try {
      const res = await fetch(url + "/api/non-existent-action");
      expect(res.status).toBe(404);
      const response = (await res.json()) as ActionResponse<Status>;
      expect(response.error?.message).toContain("Action not found");
      expect(response.error?.stack).toBeUndefined();
    } finally {
      config.server.web.includeStackInErrors = original;
    }
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

describe("CORS headers", () => {
  test("wildcard allowedOrigins without Origin header returns * and no credentials", async () => {
    const original = config.server.web.allowedOrigins;
    (config.server.web as any).allowedOrigins = "*";
    try {
      const res = await fetch(url + "/api/status");
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    } finally {
      (config.server.web as any).allowedOrigins = original;
    }
  });

  test("wildcard allowedOrigins with Origin header reflects origin and sets credentials", async () => {
    const original = config.server.web.allowedOrigins;
    (config.server.web as any).allowedOrigins = "*";
    try {
      const res = await fetch(url + "/api/status", {
        headers: { Origin: "http://example.com" },
      });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://example.com",
      );
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
      expect(res.headers.get("Vary")).toContain("Origin");
    } finally {
      (config.server.web as any).allowedOrigins = original;
    }
  });

  test("specific allowedOrigins with matching Origin reflects origin and sets credentials", async () => {
    const original = config.server.web.allowedOrigins;
    (config.server.web as any).allowedOrigins = "http://allowed.example.com";
    try {
      const res = await fetch(url + "/api/status", {
        headers: { Origin: "http://allowed.example.com" },
      });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://allowed.example.com",
      );
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
      expect(res.headers.get("Vary")).toContain("Origin");
    } finally {
      (config.server.web as any).allowedOrigins = original;
    }
  });

  test("specific allowedOrigins with non-matching Origin omits credentials", async () => {
    const original = config.server.web.allowedOrigins;
    (config.server.web as any).allowedOrigins = "http://allowed.example.com";
    try {
      const res = await fetch(url + "/api/status", {
        headers: { Origin: "http://evil.example.com" },
      });
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    } finally {
      (config.server.web as any).allowedOrigins = original;
    }
  });

  test("OPTIONS preflight with Origin reflects origin", async () => {
    const original = config.server.web.allowedOrigins;
    (config.server.web as any).allowedOrigins = url;
    try {
      const res = await fetch(url + "/api/status", {
        method: "OPTIONS",
        headers: { Origin: url },
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(url);
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    } finally {
      (config.server.web as any).allowedOrigins = original;
    }
  });
});

describe("cookies", () => {
  test("session cookie uses SameSite=Strict", async () => {
    const res = await fetch(url + "/api/status");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("SameSite=Strict");
  });

  test("session cookie includes HttpOnly", async () => {
    const res = await fetch(url + "/api/status");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
  });

  test("session cookie includes expected name", async () => {
    const res = await fetch(url + "/api/status");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${config.session.cookieName}=`);
  });
});

describe("correlation IDs", () => {
  test("no X-Request-Id header by default (trustProxy is false)", async () => {
    const res = await fetch(url + "/api/status");
    expect(res.headers.get("X-Request-Id")).toBeNull();
  });

  test("echoes incoming X-Request-Id when trustProxy is true", async () => {
    const original = config.server.web.correlationId.trustProxy;
    (config.server.web.correlationId as any).trustProxy = true;
    try {
      const incomingId = crypto.randomUUID();
      const res = await fetch(url + "/api/status", {
        headers: { "X-Request-Id": incomingId },
      });
      expect(res.headers.get("X-Request-Id")).toBe(incomingId);
    } finally {
      (config.server.web.correlationId as any).trustProxy = original;
    }
  });

  test("no X-Request-Id when trustProxy is true but no header sent", async () => {
    const original = config.server.web.correlationId.trustProxy;
    (config.server.web.correlationId as any).trustProxy = true;
    try {
      const res = await fetch(url + "/api/status");
      expect(res.headers.get("X-Request-Id")).toBeNull();
    } finally {
      (config.server.web.correlationId as any).trustProxy = original;
    }
  });

  test("no X-Request-Id header when correlationId.header is empty", async () => {
    const originalHeader = config.server.web.correlationId.header;
    const originalTrust = config.server.web.correlationId.trustProxy;
    (config.server.web.correlationId as any).header = "";
    (config.server.web.correlationId as any).trustProxy = true;
    try {
      const res = await fetch(url + "/api/status", {
        headers: { "X-Request-Id": crypto.randomUUID() },
      });
      expect(res.headers.get("X-Request-Id")).toBeNull();
    } finally {
      (config.server.web.correlationId as any).header = originalHeader;
      (config.server.web.correlationId as any).trustProxy = originalTrust;
    }
  });

  test("error responses also echo X-Request-Id when trustProxy is true", async () => {
    const original = config.server.web.correlationId.trustProxy;
    (config.server.web.correlationId as any).trustProxy = true;
    try {
      const incomingId = crypto.randomUUID();
      const res = await fetch(url + "/api/non-existent-action", {
        headers: { "X-Request-Id": incomingId },
      });
      expect(res.status).toBe(404);
      expect(res.headers.get("X-Request-Id")).toBe(incomingId);
    } finally {
      (config.server.web.correlationId as any).trustProxy = original;
    }
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

  test("includes ETag and Last-Modified headers", async () => {
    const res = await fetch(url + "/test.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toMatch(/^".+"$/);
    expect(res.headers.get("last-modified")).toBeTruthy();
  });

  test("includes Cache-Control header", async () => {
    const res = await fetch(url + "/test.txt");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
  });

  test("returns 304 for matching If-None-Match", async () => {
    const res1 = await fetch(url + "/test.txt");
    const etag = res1.headers.get("etag")!;
    expect(etag).toBeTruthy();

    const res2 = await fetch(url + "/test.txt", {
      headers: { "If-None-Match": etag },
    });
    expect(res2.status).toBe(304);
  });

  test("returns 200 for non-matching If-None-Match", async () => {
    const res = await fetch(url + "/test.txt", {
      headers: { "If-None-Match": '"bogus"' },
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("hello static");
  });

  test("returns 304 for If-Modified-Since when file is not newer", async () => {
    const res1 = await fetch(url + "/test.txt");
    const lastModified = res1.headers.get("last-modified")!;
    expect(lastModified).toBeTruthy();

    const res2 = await fetch(url + "/test.txt", {
      headers: { "If-Modified-Since": lastModified },
    });
    expect(res2.status).toBe(304);
  });

  test("returns 200 for If-Modified-Since in the distant past", async () => {
    const res = await fetch(url + "/test.txt", {
      headers: { "If-Modified-Since": "Thu, 01 Jan 1970 00:00:00 GMT" },
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("hello static");
  });

  test("omits ETag when staticFilesEtag is disabled", async () => {
    const original = config.server.web.staticFilesEtag;
    (config.server.web as any).staticFilesEtag = false;
    try {
      const res = await fetch(url + "/test.txt");
      expect(res.status).toBe(200);
      expect(res.headers.get("etag")).toBeNull();
      expect(res.headers.get("last-modified")).toBeNull();
    } finally {
      (config.server.web as any).staticFilesEtag = original;
    }
  });
});
