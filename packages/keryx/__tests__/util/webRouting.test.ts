import { describe, expect, test } from "bun:test";
import { ErrorType } from "../../classes/TypedError";
import { parseRequestParams } from "../../util/webRouting";

// Helpers to build minimal Request objects for testing
function jsonRequest(body: Record<string, unknown>, method = "POST"): Request {
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
      expect(params.id).toBe("42");
      expect(params.slug).toBe("hello-world");
    });

    test("works with no path params", async () => {
      const req = new Request("http://localhost/test", { method: "GET" });
      const params = await parseRequestParams(req, parsedUrl());
      expect(Object.keys(params)).toHaveLength(0);
    });
  });

  describe("JSON body", () => {
    test("parses simple key-value pairs", async () => {
      const params = await parseRequestParams(
        jsonRequest({ name: "Alice", age: 30 }),
        parsedUrl(),
      );
      expect(params.name).toBe("Alice");
      expect(params.age).toBe(30);
    });

    test("handles array values", async () => {
      const params = await parseRequestParams(
        jsonRequest({ tags: ["a", "b", "c"] }),
        parsedUrl(),
      );
      expect(params.tags).toEqual(["a", "b", "c"]);
    });

    test("handles empty arrays", async () => {
      const params = await parseRequestParams(
        jsonRequest({ tags: [] }),
        parsedUrl(),
      );
      expect(params.tags).toEqual([]);
    });

    test("preserves nested objects", async () => {
      const nested = { street: "123 Main St", city: "Springfield" };
      const params = await parseRequestParams(
        jsonRequest({ address: nested }),
        parsedUrl(),
      );
      expect(params.address).toEqual(nested);
    });

    test("preserves arrays of objects", async () => {
      const patches = [
        { startLine: 2, originalLines: ["old"], newLines: ["new"] },
        { startLine: 5, originalLines: ["a", "b"], newLines: ["c"] },
      ];
      const params = await parseRequestParams(
        jsonRequest({ patches }),
        parsedUrl(),
      );
      expect(params.patches).toEqual(patches);
    });

    test("preserves booleans", async () => {
      const params = await parseRequestParams(
        jsonRequest({ active: true, deleted: false }),
        parsedUrl(),
      );
      expect(params.active).toBe(true);
      expect(params.deleted).toBe(false);
    });

    test("preserves numbers", async () => {
      const params = await parseRequestParams(
        jsonRequest({ count: 42, ratio: 3.14 }),
        parsedUrl(),
      );
      expect(params.count).toBe(42);
      expect(params.ratio).toBe(3.14);
    });

    test("preserves null values", async () => {
      const params = await parseRequestParams(
        jsonRequest({ name: "Alice", deletedAt: null }),
        parsedUrl(),
      );
      expect(params.deletedAt).toBeNull();
    });

    test("preserves mixed types in a single body", async () => {
      const body = {
        name: "Alice",
        age: 30,
        active: true,
        tags: ["a", "b"],
        address: { city: "NYC" },
        scores: [1, 2, 3],
        deletedAt: null,
      };
      const params = await parseRequestParams(jsonRequest(body), parsedUrl());
      expect(params).toEqual(body);
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
      expect(params.foo).toBe("bar");
    });
  });

  describe("form-urlencoded body", () => {
    test("parses application/x-www-form-urlencoded body", async () => {
      const params = await parseRequestParams(
        formUrlencodedRequest("name=Alice&color=blue"),
        parsedUrl(),
      );
      expect(params.name).toBe("Alice");
      expect(params.color).toBe("blue");
    });

    test("handles repeated keys in urlencoded body", async () => {
      const params = await parseRequestParams(
        formUrlencodedRequest("tag=a&tag=b&tag=c"),
        parsedUrl(),
      );
      expect(params.tag).toEqual(["a", "b", "c"]);
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
      expect(params.limit).toBe("10");
      expect(params.offset).toBe("5");
    });

    test("handles repeated query params as array", async () => {
      const req = new Request("http://localhost/test?id=1&id=2&id=3", {
        method: "GET",
      });
      const params = await parseRequestParams(req, parsedUrl("id=1&id=2&id=3"));
      expect(params.id).toEqual(["1", "2", "3"]);
    });
  });

  describe("param merge order", () => {
    test("body params override path params, query params append", async () => {
      const params = await parseRequestParams(
        jsonRequest({ name: "from-body" }),
        parsedUrl("extra=query-val"),
        { name: "from-path" },
      );
      // path params set first, then body overwrites
      expect(params.name).toBe("from-body");
      expect(params.extra).toBe("query-val");
    });
  });
});
