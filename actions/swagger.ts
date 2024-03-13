import { Action, config, api } from "../api";
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

export class Swagger extends Action {
  constructor() {
    super({
      name: "swagger",
      description: "return API documentation in the OpenAPI specification",
      web: { route: "/swagger", method: "GET" },
    });
  }

  async run() {
    const swaggerPaths = buildSwaggerPaths();

    return {
      swagger: SWAGGER_VERSION,
      info: {
        version: packageJSON.version,
        title: packageJSON.name,
        license: { name: packageJSON.license },
      },
      host: `${config.server.web.host}:${config.server.web.port}`,
      basePath: `${config.server.web.apiRoute}/`,
      schemes: ["https", "http"],
      paths: swaggerPaths,

      securityDefinitions: {
        // TODO (custom)?
      },
      externalDocs: {
        description: "Learn more about this server",
        url: `${config.server.web.host}:${config.server.web.port}`,
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
      summary: action.description || "no description",
      consumes: ["application/json"],
      produces: ["application/json"],
      responses: swaggerResponses,
      security: [],
      parameters: [], //TODO
    };
  }

  return swaggerPaths;
}
