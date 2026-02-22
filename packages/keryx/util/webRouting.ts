import type { parse } from "node:url";
import { api } from "../api";
import type { HTTP_METHOD } from "../classes/Action";
import { ErrorType, TypedError } from "../classes/TypedError";
import { config } from "../config";

/**
 * Match a URL path + HTTP method against registered action routes.
 * Returns the action name and any extracted path parameters, or `null` if no match.
 */
export async function determineActionName(
  url: ReturnType<typeof parse>,
  method: HTTP_METHOD,
): Promise<
  | { actionName: string; pathParams?: Record<string, string> }
  | { actionName: null; pathParams: null }
> {
  const pathToMatch = url.pathname?.replace(
    new RegExp(`${config.server.web.apiRoute}`),
    "",
  );

  for (const action of api.actions.actions) {
    if (!action?.web?.route) continue;

    // Convert route with path parameters to regex
    const routeWithParams = `${action.web.route}`.replace(/:\w+/g, "([^/]+)");
    const matcher =
      action.web.route instanceof RegExp
        ? action.web.route
        : new RegExp(`^${routeWithParams}$`);

    if (
      pathToMatch &&
      pathToMatch.match(matcher) &&
      method.toUpperCase() === action.web.method
    ) {
      // Extract path parameters if the route has them
      const pathParams: Record<string, string> = {};
      const paramNames = (`${action.web.route}`.match(/:\w+/g) || []).map(
        (name) => name.slice(1),
      );
      const match = pathToMatch.match(matcher);

      if (match && paramNames.length > 0) {
        // Skip the first match (full string) and use the captured groups
        for (let i = 0; i < paramNames.length; i++) {
          const value = match[i + 1];
          if (value !== undefined) {
            pathParams[paramNames[i]] = value;
          }
        }
      }

      return {
        actionName: action.name,
        pathParams: Object.keys(pathParams).length > 0 ? pathParams : undefined,
      };
    }
  }

  return { actionName: null, pathParams: null };
}

/**
 * Parse request parameters from path params, request body (JSON or form-data),
 * and query string into a single `FormData` instance.
 *
 * @param req - The incoming HTTP request.
 * @param url - The parsed URL (for query string).
 * @param pathParams - Path parameters extracted by route matching.
 * @returns A `FormData` containing all merged parameters.
 */
export async function parseRequestParams(
  req: Request,
  url: ReturnType<typeof parse>,
  pathParams?: Record<string, string>,
): Promise<FormData> {
  // param load order: path params -> url params -> body params -> query params
  let params = new FormData();

  // Add path parameters
  if (pathParams) {
    for (const [key, value] of Object.entries(pathParams)) {
      params.set(key, String(value));
    }
  }

  if (
    req.method !== "GET" &&
    req.headers.get("content-type") === "application/json"
  ) {
    try {
      const bodyContent = (await req.json()) as Record<string, unknown>;
      for (const [key, value] of Object.entries(bodyContent)) {
        if (Array.isArray(value)) {
          // Handle arrays by appending each element
          if (value.length === 0) {
            // For empty arrays, set an empty string to indicate the field exists
            params.set(key, "");
          } else {
            for (const item of value) {
              params.append(key, item);
            }
          }
        } else {
          params.set(key, value as any);
        }
      }
    } catch (e) {
      throw new TypedError({
        message: `cannot parse request body: ${e}`,
        type: ErrorType.CONNECTION_ACTION_RUN,
        originalError: e,
      });
    }
  } else if (
    req.method !== "GET" &&
    (req.headers.get("content-type")?.includes("multipart/form-data") ||
      req.headers
        .get("content-type")
        ?.includes("application/x-www-form-urlencoded"))
  ) {
    const f = await req.formData();
    f.forEach((value, key) => {
      params.append(key, value);
    });
  }

  if (url.query) {
    for (const [key, values] of Object.entries(url.query)) {
      if (values !== undefined) {
        if (Array.isArray(values)) {
          for (const v of values) params.append(key, v);
        } else {
          params.append(key, values);
        }
      }
    }
  }

  return params;
}
