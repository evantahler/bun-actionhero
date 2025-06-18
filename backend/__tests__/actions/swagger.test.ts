import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { api, type ActionResponse } from "../../api";
import { config } from "../../config";
import type { Swagger } from "../../actions/swagger";

const url = config.server.web.applicationUrl;

beforeAll(async () => {
  await api.start();
});

afterAll(async () => {
  await api.stop();
});

describe("swagger", () => {
  test("the swagger endpoint returns metadata about the server", async () => {
    const res = await fetch(url + "/api/swagger");
    expect(res.status).toBe(200);
    const response = (await res.json()) as ActionResponse<Swagger>;

    // OpenAPI 3.0 structure
    expect(response.openapi).toBe("3.0.0");
    expect(response.info.title).toBe("actionhero");
    expect(response.servers).toBeDefined();
    const serverUrl = response.servers![0].url;
    expect(serverUrl.endsWith("/api") || serverUrl.endsWith("/api/")).toBe(
      true,
    );

    expect(Object.keys(response.paths).length).toBeGreaterThan(2);

    // Check that the swagger endpoint itself is documented
    expect(response.paths["/swagger"]).toBeDefined();
    expect(response.paths["/swagger"]?.get).toBeDefined();
    expect(response.paths["/swagger"]?.get?.summary).toBe(
      "Return API documentation in the OpenAPI specification",
    );
    expect(response.paths["/swagger"]?.get?.responses["200"]).toBeDefined();
  });
});
