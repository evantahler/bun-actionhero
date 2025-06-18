import { z } from "zod";
import { Action, config, api } from "../api";
import { HTTP_METHOD } from "../classes/Action";
import packageJSON from "../package.json";
import {
  OpenAPIRegistry,
  extendZodWithOpenApi,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";

// Extend Zod with OpenAPI support
extendZodWithOpenApi(z);

const SWAGGER_VERSION = "3.0.0";

const genericResponseSchema = z.object({});
const errorResponseSchema = z.object({ error: z.string() });

const swaggerResponses = {
  "200": {
    description: "successful operation",
    content: {
      "application/json": {
        schema: genericResponseSchema,
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
    const registry = new OpenAPIRegistry();

    // Register all actions with their Zod schemas
    for (const action of api.actions.actions) {
      if (!action.web?.route || !action.web?.method) continue;

      const path = action.web.route;
      const method = action.web.method.toLowerCase();

      // Create request body schema if action has inputs
      let requestBody: any = undefined;
      if (action.inputs && typeof action.inputs.parse === "function") {
        const zodSchema = action.inputs as z.ZodType;
        const schemaRef = registry.register(
          `RequestBody_${action.name}`,
          zodSchema,
        );

        requestBody = {
          required: true,
          content: {
            "application/json": {
              schema: schemaRef,
            },
          },
        };
      }

      // Register the operation
      registry.registerPath({
        method,
        path,
        summary: action.description || action.name,
        requestBody,
        responses: swaggerResponses,
        tags: [action.name.split(":")[0]], // Group by action namespace
      });
    }

    const generator = new OpenApiGeneratorV3(registry.definitions);
    const document = generator.generateDocument({
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
    });

    return document;
  }
}
