import cookie from "cookie";
import { Connection } from "../classes/Connection";
import { ErrorStatusCodes, ErrorType, TypedError } from "../classes/TypedError";
import { Server } from "../classes/Server";
import { config } from "../config";
import { logger, api } from "../api";
import { parse } from "node:url";
import { randomUUID } from "crypto";
import { type HTTP_METHOD, type ActionParams } from "../classes/Action";
import type { ServerWebSocket } from "bun";
import type {
  ClientSubscribeMessage,
  ClientUnsubscribeMessage,
  PubSubMessage,
} from "../initializers/pubsub";

const MAX_STARTUP_ATTEMPTS = 5;

export class WebServer extends Server<ReturnType<typeof Bun.serve>> {
  constructor() {
    super("web");
  }

  async initialize() {}

  async start() {
    if (config.server.web.enabled !== true) return;

    logger.info(
      `starting app server @ http://${config.server.web.host}:${config.server.web.port}`,
    );

    let startupAttempts = 0;
    while (startupAttempts < MAX_STARTUP_ATTEMPTS) {
      try {
        this.server = Bun.serve({
          port: config.server.web.port,
          hostname: config.server.web.host,

          // error: (error) => {
          //   return new Response(`Error: ${error.message}`);
          // },
          fetch: this.handleIncomingConnection.bind(this),
          websocket: {
            open: this.handleWebSocketConnectionOpen.bind(this),
            message: this.handleWebSocketConnectionMessage.bind(this),
            close: this.handleWebSocketConnectionClose.bind(this),
          },
        });
        break;
      } catch (e) {
        await Bun.sleep(1000);
        startupAttempts++;
      }
    }
  }

  async stop() {
    //TODO: Graceful shutdown
    // in test, we want to hard-kill the server
    if (this.server) {
      this.server.stop(true);
      logger.info(
        `stopped app server @ ${config.server.web.host}:${config.server.web.port + 1}`,
      );
    }

    // while (this.server.pendingRequests + this.server.pendingWebSockets > 0) {
    //   logger.debug(
    //     `server stop pending pendingRequests:${this.server.pendingRequests}, pendingWebSockets:${this.server.pendingWebSockets}`,
    //   );
    //   await Bun.sleep(1000);
    // }
  }

  async handleIncomingConnection(
    req: Request,
    server: ReturnType<typeof Bun.serve>,
  ) {
    const ip = server.requestIP(req)?.address || "unknown-IP";
    const headers = req.headers;
    const cookies = cookie.parse(req.headers.get("cookie") ?? "");
    const id = cookies[config.session.cookieName] || randomUUID();

    if (server.upgrade(req, { data: { ip, id, headers, cookies } })) return; // upgrade the request to a WebSocket

    const parsedUrl = parse(req.url!, true);
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

  handleWebSocketConnectionClose(ws: ServerWebSocket) {
    const { connection } = api.connections.find(
      "websocket",
      //@ts-expect-error
      ws.data.ip,
      //@ts-expect-error
      ws.data.id,
    );
    try {
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
    connection.subscribe(formattedMessage.channel);
    ws.send(
      JSON.stringify({
        messageId: formattedMessage.messageId,
        subscribed: { channel: formattedMessage.channel },
      }),
    );
  }

  async handleWebsocketUnsubscribe(
    connection: Connection,
    ws: ServerWebSocket,
    formattedMessage: ClientUnsubscribeMessage,
  ) {
    connection.unsubscribe(formattedMessage.channel);
    ws.send(
      JSON.stringify({
        messageId: formattedMessage.messageId,
        unsubscribed: { channel: formattedMessage.channel },
      }),
    );
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

    // Handle OPTIONS requests.
    // As we don't really know what action the client wants (HTTP Method is always OPTIONS), we just return a 200 response.
    if (httpMethod === "OPTIONS") return buildResponse(connection, {});

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

    connection.destroy();

    if (error && ErrorStatusCodes[error.type]) {
      errorStatusCode = ErrorStatusCodes[error.type];
    }

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
  headers["X-SERVER-NAME"] = config.process.name;
  headers["Access-Control-Allow-Origin"] = config.server.web.allowedOrigins;
  headers["Access-Control-Allow-Methods"] = config.server.web.allowedMethods;
  headers["Access-Control-Allow-Credentials"] = "true";

  if (connection) {
    headers["Set-Cookie"] =
      `${config.session.cookieName}=${connection.id}; Max-Age=${config.session.ttl}; Path=/; HttpOnly`;
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
  return new Response(
    JSON.stringify({ error: buildErrorPayload(error) }, null, 2) + EOL,
    {
      status,
      headers: buildHeaders(connection),
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
    stack: error.stack,
  };
}

const EOL = "\r\n";
