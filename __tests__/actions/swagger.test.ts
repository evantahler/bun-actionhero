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

    expect(response.basePath).toInclude("/api/");
    expect(response.host).toInclude(
      config.server.web.applicationUrl
        .replace(/^https?:\/\//, "")
        .replace(/^http?:\/\//, ""),
    );

    expect(Object.keys(response.paths).length).toBeGreaterThan(2);

    expect(response.paths["/swagger"]).toEqual({
      get: {
        consumes: ["application/json"],
        parameters: [],
        produces: ["application/json"],
        responses: {
          "200": {
            description: "successful operation",
          },
          "400": {
            description: "Invalid input",
          },
          "404": {
            description: "Not Found",
          },
          "422": {
            description: "Missing or invalid params",
          },
          "500": {
            description: "Server error",
          },
        },
        security: [],
        summary: "Return API documentation in the OpenAPI specification",
      },
    });
  });
});
