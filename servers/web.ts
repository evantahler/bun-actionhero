import cookie from "cookie";
import colors from "colors";
import formidable from "formidable";
import { Connection } from "../classes/Connection";
import { ErrorType, TypedError } from "../classes/TypedError";
import { Server } from "../classes/Server";
import { config } from "../config";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { logger, api } from "../api";
import { parse } from "node:url";
import { parseHeadersForClientAddress } from "../util/parseHeadersForClientAddress";
import { type HTTP_METHOD } from "../classes/Action";
import { Socket } from "node:net";
import querystring from "node:querystring";

export class WebServer extends Server<ReturnType<typeof createServer>> {
  sockets: Record<number, Socket>;
  socketCounter: number;
  started: boolean;

  constructor() {
    super("web");
    this.sockets = {};
    this.socketCounter = 0;
    this.started = false;
  }

  async initialize() {
    this.server = createServer(this.handleIncomingConnection.bind(this));

    this.server.on("error", (e) => {
      throw new TypedError({
        message: `cannot start web server @ ${config.server.web.host}:${config.server.web.port} => ${e.message}`,
        type: ErrorType.SERVER_START,
        originalError: e,
      });
    });

    this.server.on("connection", (socket) => {
      const id = this.socketCounter;
      this.sockets[id] = socket;
      socket.on("close", () => delete this.sockets[id]);
      this.socketCounter++;
    });
  }

  async start() {
    if (config.server.web.enabled !== true) return;

    logger.info(
      `starting web server @ ${config.server.web.applicationUrl} (via bind @ ${config.server.web.host}:${config.server.web.port})`,
    );

    await new Promise((resolve) => {
      if (!this.server) {
        throw new TypedError({
          message: "server not initialized",
          type: ErrorType.SERVER_START,
        });
      }

      this.server.listen(config.server.web.port, config.server.web.host, () => {
        this.started = true;
        resolve(true);
      });
    });
  }

  async stop() {
    await new Promise(async (resolve, reject) => {
      if (this.server && this.started) {
        this.server.close((err) => {
          if (err) reject(err);
          logger.info(
            `stopped web server @ ${config.server.web.applicationUrl} (via bind @ ${config.server.web.host}:${config.server.web.port})`,
          );
          resolve(true);
        });

        let destroyedClients = 0;
        for (const socket of Object.values(this.sockets)) {
          socket.destroy();
          destroyedClients++;
        }

        if (destroyedClients > 0) {
          logger.info(`destroyed ${destroyedClients} hanging sockets`);
        }
      } else {
        resolve(true);
      }
    });
  }

  async handleIncomingConnection(req: IncomingMessage, res: ServerResponse) {
    const isCorrectUrl = this.checkApplicationUrl(req, res);
    if (!isCorrectUrl) return;

    const parsedUrl = parse(req.url!, true);
    if (parsedUrl.path?.startsWith(`${config.server.web.apiRoute}/`)) {
      this.handleAction(req, res, parsedUrl);
    } else if (typeof api.next.handle === "function") {
      logNextRequest(req, res, parsedUrl);
      api.next.handle(req, res, parsedUrl);
    } else {
      this.buildError(
        res,
        undefined,
        new TypedError({
          message: "static server not enabled",
          type: ErrorType.CONNECTION_SERVER_ERROR,
        }),
        404,
      );
    }
  }

  checkApplicationUrl(req: IncomingMessage, res: ServerResponse) {
    if (config.server.web.applicationUrl.length > 3) {
      const requestHost = req.headers["x-forwarded-proto"]
        ? req.headers["x-forwarded-proto"] + "://" + req.headers.host
        : "http://" + req.headers.host;

      if (config.server.web.applicationUrl !== requestHost) {
        res.statusCode = 302;
        res.setHeader("Location", config.server.web.applicationUrl + req.url);
        res.end(
          `You are being redirected to ${config.server.web.applicationUrl + req.url}\r\n`,
        );

        return false;
      }
    }

    return true;
  }

  async handleAction(
    req: IncomingMessage,
    res: ServerResponse,
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

    const { ip, port } = parseHeadersForClientAddress(req);
    const cookies = cookie.parse(req.headers["cookie"] ?? "");

    const idFromCookie = cookies[config.session.cookieName];

    const connection = new Connection(this.name, ip, idFromCookie);
    const actionName = await this.determineActionName(url, httpMethod);
    if (!actionName) errorStatusCode = 404;

    // param load order: url params -> body params -> query params
    let params = new FormData();

    if (req.headers["content-type"] === "application/json") {
      const bodyString: string = await new Promise((resolve, reject) => {
        let body: Uint8Array[] = [];
        req
          .on("error", (err) => reject(err))
          .on("data", (chunk) => body.push(chunk))
          .on("end", () => resolve(Buffer.concat(body).toString()));
      });

      if (bodyString) {
        try {
          const bodyContent = JSON.parse(bodyString) as Record<string, string>;
          for (const [key, value] of Object.entries(bodyContent)) {
            params.set(key, value);
          }
        } catch (e) {
          if (e instanceof Error) {
            if (
              e.message.includes("Unexpected end of JSON input") ||
              e.message.includes("JSON Parse error")
            ) {
              const bodyQuery = querystring.parse(bodyString);
              for (const [key, values] of Object.entries(bodyQuery)) {
                if (values !== undefined) {
                  if (Array.isArray(values)) {
                    for (const v of values) params.append(key, v);
                  } else {
                    params.append(key, values);
                  }
                }
              }
            } else {
              throw new TypedError({
                message: `cannot parse request body: ${e.message}`,
                type: ErrorType.CONNECTION_ACTION_RUN,
                originalError: e,
              });
            }
          } else {
            throw new TypedError({
              message: `cannot parse request body: ${e}`,
              type: ErrorType.CONNECTION_ACTION_RUN,
              originalError: e,
            });
          }
        }
      }
    } else {
      const form = formidable({ multiples: true });
      const [fields, files] = await form.parse(req);

      for (const [key, values] of Object.entries(fields)) {
        if (values !== undefined) {
          if (Array.isArray(values)) {
            for (const v of values) params.append(key, v);
          } else {
            params.append(key, values);
          }
        }
      }

      // TODO: FILES

      // for (const [key, values] of Object.entries(files)) {
      //   if (values !== undefined) {
      //     if (Array.isArray(values)) {
      //       for (const v of values) params.append(key, v);
      //     } else {
      //       params.append(key, values);
      //     }
      //   }
      // }
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
      ? this.buildError(res, connection, error, errorStatusCode)
      : this.buildResponse(res, connection, response);
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

  async buildResponse(
    res: ServerResponse,
    connection: Connection,
    response: Object,
    status = 200,
  ) {
    res.writeHead(status, buildHeaders(connection));
    res.end(JSON.stringify(response, null, 2) + EOL);
  }

  async buildError(
    res: ServerResponse,
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

    res.writeHead(status, buildHeaders(connection));
    res.end(JSON.stringify({ error: errorPayload }, null, 2) + EOL);
  }
}

const buildHeaders = (connection?: Connection) => {
  const headers: Record<string, string> = {};

  headers["Content-Type"] = "application/json";
  headers["x-server-name"] = config.process.name;

  if (connection) {
    headers["Set-Cookie"] =
      `${config.session.cookieName}=${connection.id}; Max-Age=${config.session.ttl}`; //HttpOnly; SameSite=Strict; Path=/
  }

  return headers;
};

const logNextRequest = (
  req: IncomingMessage,
  res: ServerResponse,
  url: ReturnType<typeof parse>,
) => {
  const startTime = new Date().getTime();
  const { ip, port } = parseHeadersForClientAddress(req);

  res.on("finish", () => {
    // res.statusCode

    const loggingQuery = config.logger.colorize
      ? colors.gray(JSON.stringify(url.query))
      : JSON.stringify(url.query);

    const statusMessage = `[ASSET:${res.statusCode}]`;
    const messagePrefix = config.logger.colorize
      ? res.statusCode >= 200 && res.statusCode < 400
        ? colors.bgBlue(statusMessage)
        : colors.bgMagenta(statusMessage)
      : statusMessage;

    const duration = new Date().getTime() - startTime;
    const message = `${messagePrefix} ${url.path} (${duration}ms) ${req.method && req.method?.length > 0 ? `[${req.method}]` : ""} ${ip} ${loggingQuery}`;

    logger.info(config.logger.colorize ? colors.gray(message) : message);
  });
};

const EOL = "\r\n";
