import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Swagger } from "../../actions/swagger";
import { api, type ActionResponse } from "../../api";
import { config } from "../../config";

const url = config.server.web.applicationUrl;

beforeAll(async () => {
  await api.start();
});

afterAll(async () => {
  await api.stop();
});

describe("swagger", () => {
  test("the swagger endpoint returns valid OpenAPI 3.0 metadata", async () => {
    const res = await fetch(url + "/api/swagger");
    expect(res.status).toBe(200);
    const response = (await res.json()) as ActionResponse<Swagger>;

    // OpenAPI 3.0 structure
    expect(response.openapi).toBe("3.0.0");
    expect(response.info.title).toBe("actionhero");
    expect(response.info.version).toBeDefined();
    expect(response.info.license).toBeDefined();
    expect(response.info.description).toBeDefined();

    expect(response.servers).toBeDefined();
    expect(response.servers!.length).toBeGreaterThan(0);
    const serverUrl = response.servers![0].url;
    expect(serverUrl.endsWith("/api") || serverUrl.endsWith("/api/")).toBe(
      true,
    );
  });

  // Helper function to convert route format for swagger tests
  const convertRouteForSwagger = (route: string): string => {
    return route.replace(/:\w+/g, (match) => `{${match.slice(1)}}`);
  };

  test("swagger documents all web actions", async () => {
    const res = await fetch(url + "/api/swagger");
    const response = (await res.json()) as ActionResponse<Swagger>;

    // Count web actions (actions with both route and method)
    const webActions = api.actions.actions.filter(
      (action) => action.web?.route && action.web?.method,
    );

    // Count unique routes (since multiple methods on same route are grouped)
    const uniqueRoutes = new Set(
      webActions.map((action) => convertRouteForSwagger(action.web!.route)),
    );
    expect(Object.keys(response.paths).length).toBe(uniqueRoutes.size);

    // Verify each web action is documented
    for (const action of webActions) {
      const path = convertRouteForSwagger(action.web!.route);
      const method = action.web!.method.toLowerCase();

      expect(response.paths[path]).toBeDefined();
      expect(response.paths[path]![method]).toBeDefined();
      expect(response.paths[path]![method]!.summary).toBe(
        action.description || action.name,
      );
    }
  });

  test("swagger documents request bodies for actions with inputs", async () => {
    const res = await fetch(url + "/api/swagger");
    const response = (await res.json()) as ActionResponse<Swagger>;

    // Find actions with Zod inputs
    const actionsWithInputs = api.actions.actions.filter(
      (action) => action.web?.route && action.web?.method && action.inputs,
    );

    for (const action of actionsWithInputs) {
      const path = convertRouteForSwagger(action.web!.route);
      const method = action.web!.method.toLowerCase();
      const pathObj = response.paths[path]![method]!;

      // GET and HEAD methods should not have requestBody
      if (method === "get" || method === "head") {
        expect(pathObj.requestBody).toBeUndefined();
      } else {
        expect(pathObj.requestBody).toBeDefined();
        expect(pathObj.requestBody!.required).toBe(true);
        expect(pathObj.requestBody!.content["application/json"]).toBeDefined();
        const schema = pathObj.requestBody!.content["application/json"].schema;
        expect(schema).toBeDefined();
        // Should be a $ref
        expect(typeof schema.$ref).toBe("string");
        // The referenced schema should exist in components.schemas
        const refName = schema.$ref.replace("#/components/schemas/", "");
        expect(response.components.schemas[refName]).toBeDefined();
      }
    }
  });

  test("swagger documents standard response codes", async () => {
    const res = await fetch(url + "/api/swagger");
    const response = (await res.json()) as ActionResponse<Swagger>;

    // Check a specific endpoint (swagger itself)
    const swaggerPath = response.paths["/swagger"]!.get!;

    expect(swaggerPath.responses["200"]).toBeDefined();
    expect(swaggerPath.responses["400"]).toBeDefined();
    expect(swaggerPath.responses["404"]).toBeDefined();
    expect(swaggerPath.responses["422"]).toBeDefined();
    expect(swaggerPath.responses["500"]).toBeDefined();

    // Verify response schemas
    expect(
      swaggerPath.responses["200"]!.content["application/json"].schema,
    ).toBeDefined();
    expect(
      swaggerPath.responses["400"]!.content["application/json"].schema,
    ).toBeDefined();
  });

  test("swagger groups actions by tags", async () => {
    const res = await fetch(url + "/api/swagger");
    const response = (await res.json()) as ActionResponse<Swagger>;

    // Check that actions are tagged by their namespace
    for (const action of api.actions.actions) {
      if (!action.web?.route || !action.web?.method) continue;

      const path = convertRouteForSwagger(action.web.route);
      const method = action.web.method.toLowerCase();
      const pathObj = response.paths[path]![method]!;

      expect(pathObj.tags).toBeDefined();
      expect(pathObj.tags!.length).toBeGreaterThan(0);

      const expectedTag = action.name.split(":")[0];
      expect(pathObj.tags).toContain(expectedTag);
    }
  });

  test("swagger endpoint itself is documented", async () => {
    const res = await fetch(url + "/api/swagger");
    const response = (await res.json()) as ActionResponse<Swagger>;

    expect(response.paths["/swagger"]).toBeDefined();
    expect(response.paths["/swagger"]!.get).toBeDefined();
    expect(response.paths["/swagger"]!.get!.summary).toBe(
      "Return API documentation in the OpenAPI specification",
    );
    expect(response.paths["/swagger"]!.get!.responses["200"]).toBeDefined();
  });

  test("swagger properly enumerates UserCreate action parameters", async () => {
    const res = await fetch(url + "/api/swagger");
    const response = (await res.json()) as ActionResponse<Swagger>;

    // Check the UserCreate action (PUT /user)
    const userCreatePath = response.paths["/user"]!.put!;

    expect(userCreatePath.requestBody).toBeDefined();
    const requestBody = userCreatePath.requestBody as any;
    expect(requestBody.required).toBe(true);
    expect(requestBody.content["application/json"]).toBeDefined();
    const schema = requestBody.content["application/json"].schema;
    expect(schema).toBeDefined();
    // Should be a $ref
    expect(typeof schema.$ref).toBe("string");
    const refName = schema.$ref.replace("#/components/schemas/", "");
    const resolved = response.components.schemas[refName];
    expect(resolved).toBeDefined();
    // Check that the schema is an object with properties
    expect(resolved.type).toBe("object");
    expect(resolved.properties).toBeDefined();
    // Check that all expected UserCreate parameters are present
    expect(resolved.properties.name).toBeDefined();
    expect(resolved.properties.email).toBeDefined();
    expect(resolved.properties.password).toBeDefined();
    // Check parameter types
    expect(resolved.properties.name.type).toBe("string");
    expect(resolved.properties.email.type).toBe("string");
    expect(resolved.properties.password.type).toBe("string");
    // Check required fields
    expect(resolved.required).toContain("name");
    expect(resolved.required).toContain("email");
    expect(resolved.required).toContain("password");
  });
});
