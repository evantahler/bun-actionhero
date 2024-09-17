import cookie from "cookie";
import { Connection } from "../classes/Connection";
import { ErrorType, TypedError } from "../classes/TypedError";
import { Server } from "../classes/Server";
import { config } from "../config";
import { logger, api } from "../api";
import { parse } from "node:url";
import { type HTTP_METHOD } from "../classes/Action";

export class WebServer extends Server<ReturnType<typeof Bun.serve>> {
  constructor() {
    super("web");
  }

  async initialize() {}

  async start() {
    if (config.server.web.enabled !== true) return;

    logger.info(
      `starting web server @ ${config.server.web.applicationUrl} (via bind @ ${config.server.web.host}:${config.server.web.port})`,
    );

    this.server = Bun.serve({
      port: config.server.web.port,
      hostname: config.server.web.host,
      // error: (error) => {
      //   return new Response(`Error: ${error.message}`);
      // },
      fetch: this.handleIncomingConnection.bind(this),
    });

    await Bun.sleep(1);
  }

  async stop() {
    if (!this.server) return;

    // in test, we want to hard-kill the server
    this.server.stop(process.env.NODE_ENV === "test");

    let openConnections =
      this.server.pendingRequests + this.server.pendingWebSockets;
    while (openConnections > 0) {
      await Bun.sleep(500);
      openConnections =
        this.server.pendingRequests + this.server.pendingWebSockets;
    }

    logger.info(
      `stopped web server @ ${config.server.web.applicationUrl} (via bind @ ${config.server.web.host}:${config.server.web.port})`,
    );
  }

  async handleIncomingConnection(
    req: Request,
    server: ReturnType<typeof Bun.serve>,
  ) {
    const isCorrectUrl = checkApplicationUrl(req);
    if (!isCorrectUrl) {
      return Response.redirect(config.server.web.applicationUrl + req.url, 302);
    }

    const parsedUrl = parse(req.url!, true);
    if (parsedUrl.path?.startsWith(`${config.server.web.apiRoute}/`)) {
      return this.handleAction(req, server, parsedUrl);
    } else if (typeof api.next.app) {
      const originalHost = req.headers.get("host");
      if (!originalHost) {
        throw new TypedError({
          type: ErrorType.CONNECTION_SERVER_ERROR,
          message: "no host header",
        });
      }

      // forward the request to the next.js socket
      const response = await fetch(req.url, {
        headers: req.headers,
        method: req.method,
        body: req.body,
        // @ts-ignore - This is added by Bun to allow connecting to unix sockets
        unix: api.next.socket,
      });

      response.headers.set("x-server-name", config.process.name);

      response.headers.delete("date"); // both the Bun and Next servers try to set date - we only want one
      response.headers.delete("content-encoding"); // we've already un-zipped the response, if it was

      return response;
    } else {
      return buildError(
        undefined,
        new TypedError({
          message: "static server not enabled",
          type: ErrorType.CONNECTION_SERVER_ERROR,
        }),
        404,
      );
    }
  }

  async handleAction(
    req: Request,
    server: ReturnType<typeof Bun.serve>,
    url: ReturnType<typeof parse>,
  ) {
    if (!this.server) {
      throw new TypedError({
        message: "Server server not started",
        type: ErrorType.SERVER_START,
      });
    }

    let errorStatusCode = 500;
    const httpMethod = req.method?.toUpperCase() as HTTP_METHOD;

    const ip = server.requestIP(req)?.address || "unknown-IP";
    const cookies = cookie.parse(req.headers.get("cookie") ?? "");

    const idFromCookie = cookies[config.session.cookieName];

    const connection = new Connection(this.name, ip, idFromCookie);
    const actionName = await this.determineActionName(url, httpMethod);
    if (!actionName) errorStatusCode = 404;

    // param load order: url params -> body params -> query params
    let params = new FormData();

    if (
      req.method !== "GET" &&
      req.headers.get("content-type") === "application/json"
    ) {
      try {
        const bodyContent = await req.json();
        for (const [key, value] of Object.entries(bodyContent)) {
          params.set(key, value as any);
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

      // // TODO: FILES

      // // for (const [key, values] of Object.entries(files)) {
      // //   if (values !== undefined) {
      // //     if (Array.isArray(values)) {
      // //       for (const v of values) params.append(key, v);
      // //     } else {
      // //       params.append(key, values);
      // //     }
      // //   }
      // // }
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

    const { response, error } = await connection.act(
      actionName,
      params,
      httpMethod,
      req.url,
    );

    return error
      ? buildError(connection, error, errorStatusCode)
      : buildResponse(connection, response);
  }

  async determineActionName(
    url: ReturnType<typeof parse>,
    method: HTTP_METHOD,
  ) {
    const pathToMatch = url.pathname?.replace(
      new RegExp(`${config.server.web.apiRoute}`),
      "",
    );

    for (const action of api.actions.actions) {
      if (!action?.web?.route) continue;

      const matcher =
        action.web.route instanceof RegExp
          ? action.web.route
          : new RegExp(`^${action.web.route}$`);

      if (
        pathToMatch &&
        pathToMatch.match(matcher) &&
        method.toUpperCase() === action.web.method
      ) {
        return action.name;
      }
    }
  }
}

const buildHeaders = (connection?: Connection) => {
  const headers: Record<string, string> = {};

  headers["Content-Type"] = "application/json";
  headers["x-server-name"] = config.process.name;

  if (connection) {
    headers["Set-Cookie"] =
      `${config.session.cookieName}=${connection.id}; Max-Age=${config.session.ttl}; Path=/`; //HttpOnly; SameSite=Strict;
  }

  return headers;
};

function buildResponse(connection: Connection, response: Object, status = 200) {
  return new Response(JSON.stringify(response, null, 2) + EOL, {
    status,
    headers: buildHeaders(connection),
  });
}

function buildError(
  connection: Connection | undefined,
  error: TypedError,
  status = 500,
) {
  const errorPayload = {
    message: error.message,
    type: error.type,
    timestamp: new Date().getTime(),
    key: error.key !== undefined ? error.key : undefined,
    value: error.value !== undefined ? error.value : undefined,
    stack: error.stack,
  };

  return new Response(JSON.stringify({ error: errorPayload }, null, 2) + EOL, {
    status,
    headers: buildHeaders(connection),
  });
}

function checkApplicationUrl(req: Request) {
  if (config.server.web.applicationUrl.length > 3) {
    const hostHeader = req.headers.get("host");
    const forwardHeader = req.headers.get("x-forwarded-proto");

    const requestHost = forwardHeader
      ? forwardHeader + "://" + hostHeader
      : "http://" + hostHeader;

    if (config.server.web.applicationUrl !== requestHost) return false;
  }

  return true;
}

const EOL = "\r\n";
