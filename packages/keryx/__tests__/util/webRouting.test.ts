import { describe, expect, test } from "bun:test";
import { ErrorType } from "../../classes/TypedError";
import { parseRequestParams } from "../../util/webRouting";

// Helpers to build minimal Request objects for testing
function jsonRequest(
  body: Record<string, unknown>,
  method = "POST",
): Request {
  return new Request("http://localhost/test", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function formUrlencodedRequest(body: string, method = "POST"): Request {
  return new Request("http://localhost/test", {
    method,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

function parsedUrl(qs?: string) {
  const { parse } = require("node:url");
  return parse(`http://localhost/test${qs ? `?${qs}` : ""}`, true);
}

describe("parseRequestParams", () => {
  describe("path params", () => {
    test("includes path params in the result", async () => {
      const req = new Request("http://localhost/test", { method: "GET" });
      const params = await parseRequestParams(req, parsedUrl(), {
        id: "42",
        slug: "hello-world",
      });
      expect(params.get("id")).toBe("42");
      expect(params.get("slug")).toBe("hello-world");
    });

    test("works with no path params", async () => {
      const req = new Request("http://localhost/test", { method: "GET" });
      const params = await parseRequestParams(req, parsedUrl());
      expect([...params.entries()]).toHaveLength(0);
    });
  });

  describe("JSON body", () => {
    test("parses simple key-value pairs", async () => {
      const params = await parseRequestParams(
        jsonRequest({ name: "Alice", age: 30 }),
        parsedUrl(),
      );
      expect(params.get("name")).toBe("Alice");
      expect(params.get("age")).toBe("30");
    });

    test("handles array values by appending each element", async () => {
      const params = await parseRequestParams(
        jsonRequest({ tags: ["a", "b", "c"] }),
        parsedUrl(),
      );
      expect(params.getAll("tags")).toEqual(["a", "b", "c"]);
    });

    test("handles empty array by setting empty string sentinel", async () => {
      const params = await parseRequestParams(
        jsonRequest({ tags: [] }),
        parsedUrl(),
      );
      expect(params.get("tags")).toBe("");
      expect(params.getAll("tags")).toEqual([""]);
    });

    test("throws TypedError for malformed JSON body", async () => {
      const req = new Request("http://localhost/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not valid json{",
      });
      try {
        await parseRequestParams(req, parsedUrl());
        throw new Error("should have thrown");
      } catch (e: any) {
        expect(e.type).toBe(ErrorType.CONNECTION_ACTION_RUN);
        expect(e.message).toContain("cannot parse request body");
      }
    });

    test("does not parse body for GET requests", async () => {
      const req = new Request("http://localhost/test?foo=bar", {
        method: "GET",
        headers: { "content-type": "application/json" },
      });
      const params = await parseRequestParams(req, parsedUrl("foo=bar"));
      // Should only have the query param, not try to parse body
      expect(params.get("foo")).toBe("bar");
    });
  });

  describe("form-urlencoded body", () => {
    test("parses application/x-www-form-urlencoded body", async () => {
      const params = await parseRequestParams(
        formUrlencodedRequest("name=Alice&color=blue"),
        parsedUrl(),
      );
      expect(params.get("name")).toBe("Alice");
      expect(params.get("color")).toBe("blue");
    });

    test("handles repeated keys in urlencoded body", async () => {
      const params = await parseRequestParams(
        formUrlencodedRequest("tag=a&tag=b&tag=c"),
        parsedUrl(),
      );
      expect(params.getAll("tag")).toEqual(["a", "b", "c"]);
    });
  });

  describe("query string", () => {
    test("includes query string parameters", async () => {
      const req = new Request("http://localhost/test?limit=10&offset=5", {
        method: "GET",
      });
      const params = await parseRequestParams(
        req,
        parsedUrl("limit=10&offset=5"),
      );
      expect(params.get("limit")).toBe("10");
      expect(params.get("offset")).toBe("5");
    });

    test("handles repeated query params as array", async () => {
      const req = new Request("http://localhost/test?id=1&id=2&id=3", {
        method: "GET",
      });
      const params = await parseRequestParams(req, parsedUrl("id=1&id=2&id=3"));
      expect(params.getAll("id")).toEqual(["1", "2", "3"]);
    });
  });

  describe("param merge order", () => {
    test("body params override path params, query params append", async () => {
      const params = await parseRequestParams(
        jsonRequest({ name: "from-body" }),
        parsedUrl("extra=query-val"),
        { name: "from-path" },
      );
      // path params set first, then body overwrites via set
      expect(params.get("name")).toBe("from-body");
      expect(params.get("extra")).toBe("query-val");
    });
  });
});
