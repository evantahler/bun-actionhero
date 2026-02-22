import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { api } from "../../api";
import { HOOK_TIMEOUT } from "./../setup";

beforeAll(async () => {
  await api.start();
}, HOOK_TIMEOUT);

afterAll(async () => {
  await api.stop();
}, HOOK_TIMEOUT);

describe("swagger initializer", () => {
  test("swagger namespace is initialized", () => {
    expect(api.swagger).toBeDefined();
    expect(api.swagger.responseSchemas).toBeDefined();
    expect(typeof api.swagger.responseSchemas).toBe("object");
  });

  test("responseSchemas contains entries for loaded actions", () => {
    const schemas = api.swagger.responseSchemas;
    const keys = Object.keys(schemas);
    expect(keys.length).toBeGreaterThan(0);
  });

  test("built-in status action has a response schema", () => {
    const statusSchema = api.swagger.responseSchemas["status"];
    expect(statusSchema).toBeDefined();
    expect(statusSchema.type).toBe("object");
  });

  test("response schemas have valid JSON Schema structure", () => {
    for (const schema of Object.values(api.swagger.responseSchemas)) {
      const s = schema as Record<string, unknown>;
      // Every schema should be an object with a type or a composite (oneOf, etc.)
      expect(s.type || s.oneOf || s.$ref).toBeDefined();
    }
  });

  test("object schemas have properties", () => {
    const statusSchema = api.swagger.responseSchemas["status"];
    if (statusSchema.type === "object" && statusSchema.properties) {
      expect(Object.keys(statusSchema.properties).length).toBeGreaterThan(0);
    }
  });
});
