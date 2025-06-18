import { z } from "zod";
import { Action, config, api } from "../api";
import { HTTP_METHOD } from "../classes/Action";
import packageJSON from "../package.json";

const SWAGGER_VERSION = "2.0";

const swaggerResponses = {
  200: { description: "successful operation" },
  400: { description: "Invalid input" },
  404: { description: "Not Found" },
  422: { description: "Missing or invalid params" },
  500: { description: "Server error" },
};

type SwaggerPath = {
  [method: string]: {
    summary: string;
    consumes: string[];
    produces: string[];
    parameters: Array<{
      in: string;
      name: string;
      type: string;
      required: boolean;
      default: string | number | boolean;
    }>;
    responses: typeof swaggerResponses;
    security: string[];
  };
};

export class Swagger implements Action {
  name = "swagger";
  description = "Return API documentation in the OpenAPI specification";
  web = { route: "/swagger", method: HTTP_METHOD.GET };

  async run() {
    const swaggerPaths = buildSwaggerPaths();

    return {
      swagger: SWAGGER_VERSION,
      info: {
        version: packageJSON.version,
        title: packageJSON.name,
        license: { name: packageJSON.license },
      },
      host: config.server.web.applicationUrl
        .replace(/^https?:\/\//, "")
        .replace(/^http?:\/\//, ""),
      basePath: `${config.server.web.apiRoute}/`,
      schemes: config.server.web.applicationUrl.includes("https://")
        ? ["https", "http"]
        : ["http"],
      paths: swaggerPaths,

      securityDefinitions: {
        // TODO (custom)?
      },
      externalDocs: {
        description: "Learn more about this server",
        url: config.server.web.applicationUrl,
      },
    };
  }
}

function buildSwaggerPaths() {
  const swaggerPaths: {
    [path: string]: SwaggerPath;
  } = {};

  for (const action of api.actions.actions) {
    if (!action.web?.route) continue;
    if (!action.web?.method) continue;

    const formattedPath = `${action.web.route}`;
    const method = action.web.method.toLowerCase();

    if (!swaggerPaths[formattedPath]) swaggerPaths[formattedPath] = {};

    swaggerPaths[formattedPath][method] = {
      summary: action.description || action.name,
      consumes: ["application/json"],
      produces: ["application/json"],
      responses: swaggerResponses,
      security: [],
      parameters: getActionParameters(action),
    };
  }

  return swaggerPaths;
}

function getActionParameters(action: any) {
  // Handle Zod schemas
  if (action.inputs && typeof action.inputs.parse === "function") {
    const zodSchema = action.inputs;
    const shape = zodSchema.shape || {};

    return Object.keys(shape)
      .sort()
      .map((inputName) => {
        const fieldSchema = shape[inputName];
        return {
          in: "formData",
          name: inputName,
          type: getZodFieldType(fieldSchema),
          required: !isZodOptional(fieldSchema),
          default: getZodDefault(fieldSchema),
        };
      });
  }

  return [];
}

function getZodFieldType(fieldSchema: any): string {
  if (!fieldSchema) return "string";

  const typeName = fieldSchema._def?.typeName;
  switch (typeName) {
    case "ZodString":
      return "string";
    case "ZodNumber":
      return "number";
    case "ZodBoolean":
      return "boolean";
    case "ZodArray":
      return "array";
    case "ZodObject":
      return "object";
    case "ZodOptional":
      return getZodFieldType(fieldSchema._def.innerType);
    case "ZodDefault":
      return getZodFieldType(fieldSchema._def.innerType);
    case "ZodEffects":
      return getZodFieldType(fieldSchema._def.schema);
    default:
      return "string";
  }
}

function isZodOptional(fieldSchema: any): boolean {
  if (!fieldSchema) return true;

  const typeName = fieldSchema._def?.typeName;
  if (typeName === "ZodOptional") return true;
  if (typeName === "ZodDefault") return true;

  return false;
}

function getZodDefault(fieldSchema: any): any {
  if (!fieldSchema) return undefined;

  const typeName = fieldSchema._def?.typeName;
  if (typeName === "ZodDefault") {
    const defaultValue = fieldSchema._def.defaultValue;
    return typeof defaultValue === "function" ? defaultValue() : defaultValue;
  }

  return undefined;
}
