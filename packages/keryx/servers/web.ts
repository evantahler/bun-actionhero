import type { ServerWebSocket } from "bun";
import colors from "colors";
import cookie from "cookie";
import { randomUUID } from "crypto";
import path from "node:path";
import { parse } from "node:url";
import { api, logger } from "../api";
import { type ActionParams, type HTTP_METHOD } from "../classes/Action";
import { CHANNEL_NAME_PATTERN } from "../classes/Channel";
import { Connection } from "../classes/Connection";
import { Server } from "../classes/Server";
import { ErrorStatusCodes, ErrorType, TypedError } from "../classes/TypedError";
import { config } from "../config";
import type {
  ClientSubscribeMessage,
  ClientUnsubscribeMessage,
  PubSubMessage,
} from "../initializers/pubsub";
import { buildCorsHeaders, isOriginAllowed } from "../util/http";

function validateChannelName(channel: string) {
  if (!CHANNEL_NAME_PATTERN.test(channel)) {
    throw new TypedError({
      message: `Invalid channel name`,
      type: ErrorType.CONNECTION_CHANNEL_VALIDATION,
    });
  }
}

export class WebServer extends Server<ReturnType<typeof Bun.serve>> {
  /** The actual port the server bound to (resolved after start, e.g. when config port is 0). */
  port: number = 0;
  /** The actual application URL (resolved after start). */
  url: string = "";
  /** Per-connection message rate tracking (keyed by connection id). */
  private wsRateMap = new Map<string, { count: number; windowStart: number }>();

  constructor() {
    super("web");
  }

  async initialize() {}

  async start() {
    if (config.server.web.enabled !== true) return;

    let startupAttempts = 0;
    try {
      const server = Bun.serve({
        port: config.server.web.port,
        hostname: config.server.web.host,
        fetch: this.handleIncomingConnection.bind(this),
        websocket: {
          maxPayloadLength: config.server.web.websocketMaxPayloadSize,
          open: this.handleWebSocketConnectionOpen.bind(this),
          message: this.handleWebSocketConnectionMessage.bind(this),
          close: this.handleWebSocketConnectionClose.bind(this),
        },
      });
      this.server = server;
      this.port = server.port ?? config.server.web.port;
      this.url = `http://${config.server.web.host}:${this.port}`;
      const startMessage = `started server @ ${this.url}`;
      logger.info(logger.colorize ? colors.bgBlue(startMessage) : startMessage);
    } catch (e) {
      await Bun.sleep(1000);
      startupAttempts++;
    }
  }

  async stop() {
    if (this.server) {
      this.server.stop(true);
      logger.info(
        `stopped app server @ ${config.server.web.host}:${config.server.web.port + 1}`,
      );
    }
  }

  async handleIncomingConnection(
    req: Request,
    server: ReturnType<typeof Bun.serve>,
  ) {
    const ip = server.requestIP(req)?.address || "unknown-IP";
    const headers = req.headers;
    const cookies = cookie.parse(req.headers.get("cookie") ?? "");
    const id = cookies[config.session.cookieName] || randomUUID();

    // Validate Origin header before WebSocket upgrade to prevent CSWSH
    if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const origin = req.headers.get("origin");
      if (origin && !isOriginAllowed(origin)) {
        return new Response("WebSocket origin not allowed", { status: 403 });
      }
    }

    if (server.upgrade(req, { data: { ip, id, headers, cookies } })) return; // upgrade the request to a WebSocket

    const parsedUrl = parse(req.url!, true);

    // Handle static file serving
    if (config.server.web.staticFilesEnabled && req.method === "GET") {
      const staticResponse = await this.handleStaticFile(req, parsedUrl);
      if (staticResponse) return staticResponse;
    }

    // OAuth route interception (must come before MCP route check)
    if (config.server.mcp.enabled && api.oauth?.handleRequest) {
      const oauthResponse = await api.oauth.handleRequest(req, ip);
      if (oauthResponse) return oauthResponse;
    }

    // MCP route interception
    if (config.server.mcp.enabled) {
      if (
        parsedUrl.pathname === config.server.mcp.route &&
        api.mcp?.handleRequest
      ) {
        server.timeout(req, 0); // disable idle timeout for long-lived MCP SSE streams
        return api.mcp.handleRequest(req, ip);
      }
    }

    // Don't route .well-known paths to actions
    if (parsedUrl.pathname?.startsWith("/.well-known/")) {
      return new Response(null, { status: 404 });
    }

    return this.handleWebAction(req, parsedUrl, ip, id);
  }

  handleWebSocketConnectionOpen(ws: ServerWebSocket) {
    //@ts-expect-error (ws.data is not defined in the bun types)
    const connection = new Connection("websocket", ws.data.ip, ws.data.id, ws);
    connection.onBroadcastMessageReceived = function (payload: PubSubMessage) {
      ws.send(JSON.stringify({ message: payload }));
    };
    logger.info(
      `New websocket connection from ${connection.identifier} (${connection.id})`,
    );
  }

  async handleWebSocketConnectionMessage(
    ws: ServerWebSocket,
    message: string | Buffer,
  ) {
    const { connection } = api.connections.find(
      "websocket",
      //@ts-expect-error
      ws.data.ip,
      //@ts-expect-error
      ws.data.id,
    );

    if (!connection) {
      throw new TypedError({
        message: "No connection found",
        type: ErrorType.SERVER_INITIALIZATION,
      });
    }

    // Per-connection message rate limiting
    const maxMps = config.server.web.websocketMaxMessagesPerSecond;
    if (maxMps > 0) {
      const now = Date.now();
      const entry = this.wsRateMap.get(connection.id);
      if (!entry || now - entry.windowStart >= 1000) {
        this.wsRateMap.set(connection.id, { count: 1, windowStart: now });
      } else {
        entry.count++;
        if (entry.count > maxMps) {
          ws.send(
            JSON.stringify({
              error: buildErrorPayload(
                new TypedError({
                  message: "WebSocket rate limit exceeded",
                  type: ErrorType.CONNECTION_RATE_LIMITED,
                }),
              ),
            }),
          );
          return;
        }
      }
    }

    try {
      const parsedMessage = JSON.parse(message.toString());
      if (parsedMessage["messageType"] === "action") {
        this.handleWebsocketAction(connection, ws, parsedMessage);
      } else if (parsedMessage["messageType"] === "subscribe") {
        this.handleWebsocketSubscribe(connection, ws, parsedMessage);
      } else if (parsedMessage["messageType"] === "unsubscribe") {
        this.handleWebsocketUnsubscribe(connection, ws, parsedMessage);
      } else {
        throw new TypedError({
          message: `messageType either missing or unknown`,
          type: ErrorType.CONNECTION_TYPE_NOT_FOUND,
        });
      }
    } catch (e) {
      ws.send(
        JSON.stringify({
          error: buildErrorPayload(
            new TypedError({
              message: `${e}`,
              type: ErrorType.CONNECTION_ACTION_RUN,
            }),
          ),
        }),
      );
    }
  }

  async handleWebSocketConnectionClose(ws: ServerWebSocket) {
    const { connection } = api.connections.find(
      "websocket",
      //@ts-expect-error
      ws.data.ip,
      //@ts-expect-error
      ws.data.id,
    );
    if (!connection) return;

    this.wsRateMap.delete(connection.id);

    try {
      // Remove presence from all subscribed channels before destroying
      for (const channel of connection.subscriptions) {
        try {
          await api.channels.removePresence(channel, connection);
        } catch (e) {
          logger.error(`Error removing presence on close: ${e}`);
        }
      }

      connection.destroy();
      logger.info(
        `websocket connection closed from ${connection.identifier} (${connection.id})`,
      );
    } catch (e) {
      logger.error(`Error destroying connection: ${e}`);
    }
  }

  async handleWebsocketAction(
    connection: Connection,
    ws: ServerWebSocket,
    formattedMessage: ActionParams<any>,
  ) {
    const params = new FormData();
    for (const [key, value] of Object.entries(formattedMessage.params)) {
      params.append(key, value as string);
    }

    const { response, error } = await connection.act(
      formattedMessage.action,
      params,
      "WEBSOCKET",
    );

    if (error) {
      ws.send(
        JSON.stringify({
          messageId: formattedMessage.messageId,
          error: { ...buildErrorPayload(error) },
        }),
      );
    } else {
      ws.send(
        JSON.stringify({
          messageId: formattedMessage.messageId,
          response: { ...response },
        }),
      );
    }
  }

  async handleWebsocketSubscribe(
    connection: Connection,
    ws: ServerWebSocket,
    formattedMessage: ClientSubscribeMessage,
  ) {
    try {
      validateChannelName(formattedMessage.channel);

      // Check subscription limit
      const maxSubs = config.server.web.websocketMaxSubscriptions;
      if (maxSubs > 0 && connection.subscriptions.size >= maxSubs) {
        throw new TypedError({
          message: `Too many subscriptions (max ${maxSubs})`,
          type: ErrorType.CONNECTION_CHANNEL_VALIDATION,
        });
      }

      // Ensure session is loaded before checking authorization
      if (!connection.sessionLoaded) {
        await connection.loadSession();
      }

      // Check channel authorization middleware
      await api.channels.authorizeSubscription(
        formattedMessage.channel,
        connection,
      );

      connection.subscribe(formattedMessage.channel);
      await api.channels.addPresence(formattedMessage.channel, connection);
      ws.send(
        JSON.stringify({
          messageId: formattedMessage.messageId,
          subscribed: { channel: formattedMessage.channel },
        }),
      );
    } catch (e) {
      const error =
        e instanceof TypedError
          ? e
          : new TypedError({
              message: `${e}`,
              type: ErrorType.CONNECTION_CHANNEL_AUTHORIZATION,
              originalError: e,
            });
      ws.send(
        JSON.stringify({
          messageId: formattedMessage.messageId,
          error: buildErrorPayload(error),
        }),
      );
    }
  }

  async handleWebsocketUnsubscribe(
    connection: Connection,
    ws: ServerWebSocket,
    formattedMessage: ClientUnsubscribeMessage,
  ) {
    try {
      validateChannelName(formattedMessage.channel);

      // Remove presence before unsubscribing (needs subscription still active for key resolution)
      try {
        await api.channels.removePresence(formattedMessage.channel, connection);
      } catch (e) {
        logger.error(`Error removing presence: ${e}`);
      }

      connection.unsubscribe(formattedMessage.channel);

      // Call channel middleware unsubscription hooks (for cleanup/presence)
      try {
        await api.channels.handleUnsubscription(
          formattedMessage.channel,
          connection,
        );
      } catch (e) {
        // Log but don't fail the unsubscription
        logger.error(`Error in channel unsubscription hook: ${e}`);
      }

      ws.send(
        JSON.stringify({
          messageId: formattedMessage.messageId,
          unsubscribed: { channel: formattedMessage.channel },
        }),
      );
    } catch (e) {
      const error =
        e instanceof TypedError
          ? e
          : new TypedError({
              message: `${e}`,
              type: ErrorType.CONNECTION_CHANNEL_VALIDATION,
              originalError: e,
            });
      ws.send(
        JSON.stringify({
          messageId: formattedMessage.messageId,
          error: buildErrorPayload(error),
        }),
      );
    }
  }

  async handleWebAction(
    req: Request,
    url: ReturnType<typeof parse>,
    ip: string,
    id: string,
  ) {
    if (!this.server) {
      throw new TypedError({
        message: "Server server not started",
        type: ErrorType.SERVER_START,
      });
    }

    let errorStatusCode = 500;
    const httpMethod = req.method?.toUpperCase() as HTTP_METHOD;

    const connection = new Connection("web", ip, id);

    if (
      config.server.web.correlationId.header &&
      config.server.web.correlationId.trustProxy
    ) {
      const incomingId = req.headers.get(
        config.server.web.correlationId.header,
      );
      if (incomingId) connection.correlationId = incomingId;
    }

    const requestOrigin = req.headers.get("origin") ?? undefined;

    // Handle OPTIONS requests.
    // As we don't really know what action the client wants (HTTP Method is always OPTIONS), we just return a 200 response.
    if (httpMethod === "OPTIONS")
      return buildResponse(connection, {}, 200, requestOrigin);

    const { actionName, pathParams } = await this.determineActionName(
      url,
      httpMethod,
    );
    if (!actionName) errorStatusCode = 404;

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

    const { response, error } = await connection.act(
      actionName!,
      params,
      httpMethod,
      req.url,
    );

    connection.destroy();

    if (error && ErrorStatusCodes[error.type]) {
      errorStatusCode = ErrorStatusCodes[error.type];
    }

    return error
      ? buildError(connection, error, errorStatusCode, requestOrigin)
      : buildResponse(connection, response, 200, requestOrigin);
  }

  async determineActionName(
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
          pathParams:
            Object.keys(pathParams).length > 0 ? pathParams : undefined,
        };
      }
    }

    return { actionName: null, pathParams: null };
  }

  async handleStaticFile(
    req: Request,
    url: ReturnType<typeof parse>,
  ): Promise<Response | null> {
    const staticRoute = config.server.web.staticFilesRoute;
    const staticDir = config.server.web.staticFilesDirectory;

    if (!url.pathname?.startsWith(staticRoute)) {
      return null;
    }

    const filePath = url.pathname.replace(staticRoute, "");

    // Default to index.html for root requests
    const finalPath =
      filePath === "" || filePath === "/" ? "/index.html" : filePath;

    try {
      // Construct the full file path, ensuring proper path joining
      const fullPath = path.resolve(path.join(staticDir, finalPath));
      const basePath = path.resolve(staticDir);

      // Prevent path traversal attacks (e.g. symlinks or encoded sequences)
      if (!fullPath.startsWith(basePath + path.sep) && fullPath !== basePath) {
        return null;
      }

      // Check if file exists
      const file = Bun.file(fullPath);
      const exists = await file.exists();

      if (!exists) {
        // Try serving index.html for directory requests
        if (!finalPath.endsWith(".html")) {
          const indexPath = path.resolve(
            path.join(staticDir, finalPath, "index.html"),
          );
          if (
            !indexPath.startsWith(basePath + path.sep) &&
            indexPath !== basePath
          ) {
            return null;
          }
          const indexFile = Bun.file(indexPath);
          const indexExists = await indexFile.exists();
          if (indexExists) {
            return this.buildStaticFileResponse(
              req,
              indexFile,
              finalPath + "/index.html",
            );
          }
        }
        return null; // File not found, let other handlers deal with it
      }

      return this.buildStaticFileResponse(req, file, finalPath);
    } catch (error) {
      logger.error(`Error serving static file ${finalPath}: ${error}`);
      return null;
    }
  }

  private async buildStaticFileResponse(
    req: Request,
    file: ReturnType<typeof Bun.file>,
    filePath: string,
  ): Promise<Response> {
    const headers = this.getStaticFileHeaders(filePath);

    // Generate ETag from mtime + size (fast, no hashing needed)
    if (config.server.web.staticFilesEtag) {
      const mtime = file.lastModified;
      const size = file.size;
      const etag = `"${mtime.toString(36)}-${size.toString(36)}"`;
      headers["ETag"] = etag;
      headers["Last-Modified"] = new Date(mtime).toUTCString();

      // Check If-None-Match (takes precedence over If-Modified-Since per HTTP spec)
      const ifNoneMatch = req.headers.get("if-none-match");
      if (ifNoneMatch && ifNoneMatch === etag) {
        return new Response(null, { status: 304, headers });
      }

      // Check If-Modified-Since
      const ifModifiedSince = req.headers.get("if-modified-since");
      if (ifModifiedSince) {
        const ifModifiedSinceDate = new Date(ifModifiedSince).getTime();
        // File mtime is in ms; compare at second precision (HTTP dates are second-precision)
        if (
          !isNaN(ifModifiedSinceDate) &&
          Math.floor(mtime / 1000) <= Math.floor(ifModifiedSinceDate / 1000)
        ) {
          return new Response(null, { status: 304, headers });
        }
      }
    }

    // Add Cache-Control
    if (config.server.web.staticFilesCacheControl) {
      headers["Cache-Control"] = config.server.web.staticFilesCacheControl;
    }

    return new Response(file, { headers });
  }

  private getStaticFileHeaders(filePath: string): Record<string, string> {
    const headers: Record<string, string> = {
      "X-SERVER-NAME": config.process.name,
    };

    const mimeType = Bun.file(filePath).type || "application/octet-stream";
    headers["Content-Type"] = mimeType;
    Object.assign(headers, getSecurityHeaders());

    return headers;
  }
}

function getSecurityHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(
    config.server.web.securityHeaders,
  )) {
    if (value) headers[key] = value;
  }
  return headers;
}

const buildHeaders = (connection?: Connection, requestOrigin?: string) => {
  const headers: Record<string, string> = {};

  headers["Content-Type"] = "application/json";
  headers["X-SERVER-NAME"] = config.process.name;

  const cors = buildCorsHeaders(requestOrigin, {
    "Access-Control-Allow-Methods": config.server.web.allowedMethods,
    "Access-Control-Allow-Headers": config.server.web.allowedHeaders,
  });
  if (cors["Access-Control-Allow-Origin"] && cors["Vary"]) {
    // Specific origin match (not wildcard) — allow credentials
    cors["Access-Control-Allow-Credentials"] = "true";
  }
  Object.assign(headers, cors);

  Object.assign(headers, getSecurityHeaders());

  if (connection) {
    const secure =
      config.session.cookieSecure ||
      config.server.web.applicationUrl.startsWith("https");
    const flags = [
      `${config.session.cookieName}=${connection.id}`,
      `Max-Age=${config.session.ttl}`,
      "Path=/",
      config.session.cookieHttpOnly ? "HttpOnly" : "",
      `SameSite=${config.session.cookieSameSite}`,
      secure ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ");
    headers["Set-Cookie"] = flags;

    if (connection.rateLimitInfo) {
      const rateLimitInfo = connection.rateLimitInfo;
      headers["X-RateLimit-Limit"] = String(rateLimitInfo.limit);
      headers["X-RateLimit-Remaining"] = String(rateLimitInfo.remaining);
      headers["X-RateLimit-Reset"] = String(rateLimitInfo.resetAt);
      if (rateLimitInfo.retryAfter !== undefined) {
        headers["Retry-After"] = String(rateLimitInfo.retryAfter);
      }
    }

    if (config.server.web.correlationId.header && connection.correlationId) {
      headers[config.server.web.correlationId.header] =
        connection.correlationId;
    }
  }

  return headers;
};

function buildResponse(
  connection: Connection,
  response: Object,
  status = 200,
  requestOrigin?: string,
) {
  return new Response(JSON.stringify(response, null, 2) + EOL, {
    status,
    headers: buildHeaders(connection, requestOrigin),
  });
}

function buildError(
  connection: Connection | undefined,
  error: TypedError,
  status = 500,
  requestOrigin?: string,
) {
  return new Response(
    JSON.stringify({ error: buildErrorPayload(error) }, null, 2) + EOL,
    {
      status,
      headers: buildHeaders(connection, requestOrigin),
    },
  );
}

function buildErrorPayload(error: TypedError) {
  return {
    message: error.message,
    type: error.type,
    timestamp: new Date().getTime(),
    key: error.key !== undefined ? error.key : undefined,
    value: error.value !== undefined ? error.value : undefined,
    ...(config.server.web.includeStackInErrors ? { stack: error.stack } : {}),
  };
}

const EOL = "\r\n";
