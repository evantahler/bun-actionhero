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
  description = "return API documentation in the OpenAPI specification";
  inputs = {};
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
      host: `${config.server.web.host}:${config.server.web.port}`,
      basePath: `${config.server.web.apiRoute}/`,
      schemes:
        ["0.0.0.0", "localhost"].indexOf(config.server.web.host) >= 0
          ? ["http"]
          : ["https", "http"],
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
      summary: action.description || action.name,
      consumes: ["application/json"],
      produces: ["application/json"],
      responses: swaggerResponses,
      security: [],
      parameters: Object.keys(action.inputs)
        .sort()
        .map((inputName) => {
          return {
            // in: action?.web?.route.toString().includes(`:${inputName}`)
            //   ? "path"
            //   : "query",
            in: "query",
            name: inputName,
            type: "string", // not really true, but helps the swagger validator
            required: action.inputs[inputName].required ?? false,
            //  ||
            // route.path.includes(`:${inputName}`)
            //   ? true
            //   : false
            default:
              action.inputs[inputName].default !== null &&
              action.inputs[inputName].default !== undefined
                ? typeof action.inputs[inputName].default === "object"
                  ? JSON.stringify(action.inputs[inputName].default)
                  : typeof action.inputs[inputName].default === "function"
                    ? action.inputs[inputName].default()
                    : `${action.inputs[inputName].default}`
                : undefined,
          };
        }),
    };
  }

  return swaggerPaths;
}
