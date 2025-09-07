import { zodToJsonSchema } from "zod-to-json-schema";
import { Action, api, config } from "../api";
import { HTTP_METHOD } from "../classes/Action";
import packageJSON from "../package.json";

const SWAGGER_VERSION = "3.0.0";

const errorResponseSchema = {
  type: "object",
  properties: {
    error: { type: "string" },
  },
};

const swaggerResponses = {
  "200": {
    description: "successful operation",
    content: {
      "application/json": {
        schema: {},
      },
    },
  },
  "400": {
    description: "Invalid input",
    content: {
      "application/json": {
        schema: errorResponseSchema,
      },
    },
  },
  "404": {
    description: "Not Found",
    content: {
      "application/json": {
        schema: errorResponseSchema,
      },
    },
  },
  "422": {
    description: "Missing or invalid params",
    content: {
      "application/json": {
        schema: errorResponseSchema,
      },
    },
  },
  "500": {
    description: "Server error",
    content: {
      "application/json": {
        schema: errorResponseSchema,
      },
    },
  },
};

export class Swagger implements Action {
  name = "swagger";
  description = "Return API documentation in the OpenAPI specification";
  web = { route: "/swagger", method: HTTP_METHOD.GET };

  async run() {
    const paths: Record<string, any> = {};
    const components: { schemas: Record<string, any> } = { schemas: {} };

    for (const action of api.actions.actions) {
      if (!action.web?.route || !action.web?.method) continue;
      // Convert :param format to OpenAPI {param} format
      const path = action.web.route.replace(
        /:\w+/g,
        (match: string) => `{${match.slice(1)}}`,
      );
      const method = action.web.method.toLowerCase();
      const tag = action.name.split(":")[0];
      const summary = action.description || action.name;

      // Extract path parameters from the original route
      const pathParams: any[] = [];
      const pathParamMatches = action.web.route.match(/:\w+/g) || [];
      for (const paramMatch of pathParamMatches) {
        const paramName = paramMatch.slice(1); // Remove the colon
        pathParams.push({
          name: paramName,
          in: "path",
          required: true,
          schema: { type: "string" },
          description: `The ${paramName} parameter`,
        });
      }

      // Build requestBody if Zod inputs exist and method supports body
      let requestBody: any = undefined;
      if (
        action.inputs &&
        typeof action.inputs.parse === "function" &&
        method !== "get" &&
        method !== "head"
      ) {
        const zodSchema = action.inputs;
        const schemaName = `${action.name.replace(/:/g, "_")}_Request`;
        const jsonSchema = zodToJsonSchema(zodSchema, schemaName);
        components.schemas[schemaName] =
          jsonSchema.definitions?.[schemaName] || jsonSchema;
        requestBody = {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: `#/components/schemas/${schemaName}` },
            },
          },
        };
      }

      // Build responses (200 will be generic unless action has a known output schema)
      const responses = { ...swaggerResponses };

      // Add path/method
      if (!paths[path]) paths[path] = {};
      paths[path][method] = {
        summary,
        ...(pathParams.length > 0 ? { parameters: pathParams } : {}),
        ...(requestBody ? { requestBody } : {}),
        responses,
        tags: [tag],
      };
    }

    const document = {
      openapi: SWAGGER_VERSION,
      info: {
        version: packageJSON.version,
        title: packageJSON.name,
        license: { name: packageJSON.license },
        description: packageJSON.description,
      },
      servers: [
        {
          url: config.server.web.applicationUrl + config.server.web.apiRoute,
          description: packageJSON.description,
        },
      ],
      paths,
      components,
    };
    return document;
  }
}
