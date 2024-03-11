import { Server } from "../classes/Server";
import { config } from "../config";
import { logger, api } from "../api";
import { Connection } from "../classes/Connection";
import path from "path";

const commonHeaders = {
  "Content-Type": "application/json",
  "x-server-name": config.process.name,
};

export class WebServer extends Server<ReturnType<typeof Bun.serve>> {
  constructor() {
    super("web");
  }

  async initialize() {}

  async start() {
    logger.info(
      `starting web server @ ${config.server.web.host}:${config.server.web.port}`,
    );

    this.server = Bun.serve({
      port: config.server.web.port,
      hostname: config.server.web.host,
      fetch: async (request) => this.fetch(request),
      error: async (error) => {
        logger.error(`uncaught web server error: ${error.message}`);
        return this.buildError(error);
      },
    });
  }

  async stop() {
    if (this.server) {
      this.server.stop();
      while (
        this.server.pendingRequests > 0 ||
        this.server.pendingWebSockets > 0
      ) {
        logger.info(`waiting for web server shutdown...`, {
          pendingRequests: this.server.pendingRequests,
          pendingWebSockets: this.server.pendingWebSockets,
        });

        await Bun.sleep(1000);
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    let errorStatusCode = 500;
    if (!this.server) throw new Error("server not started");

    // assets
    const requestedAsset = await this.findAsset(request);
    if (requestedAsset) return new Response(requestedAsset);

    // pages (TODO)

    // actions
    const ipAddress = this.server.requestIP(request)?.address || "unknown";
    // const contentType = request.headers.get("content-type") || "";
    const connection = new Connection(this.name, ipAddress);
    const actionName = await this.determineActionName(request);
    if (!actionName) errorStatusCode = 404;

    let params: FormData;
    try {
      params = await request.formData();
    } catch {
      params = new FormData();
    }

    // TODO: fork for files vs actions vs pages
    const { response, error } = await connection.act(
      actionName,
      params,
      request.method,
      request.url,
    );

    return error
      ? this.buildError(error, errorStatusCode)
      : this.buildResponse(response);
  }

  async findAsset(request: Request) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(`${config.server.web.assetRoute}/`)) return;

    const replacer = new RegExp(`^${config.server.web.assetRoute}/`, "g");
    const localPath = path.join(
      api.rootDir,
      "assets",
      url.pathname.replace(replacer, ""),
    );
    const filePointer = Bun.file(localPath);
    if (await filePointer.exists()) {
      return filePointer;
    } else {
      return;
    }
  }

  async determineActionName(request: Request) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(`${config.server.web.apiRoute}/`)) return;
    const pathToMatch = url.pathname.replace(
      new RegExp(`${config.server.web.apiRoute}`),
      "",
    );

    for (const action of api.actions.actions) {
      if (!action.apiRoute) continue;
      const matcher =
        action.apiRoute instanceof RegExp
          ? action.apiRoute
          : new RegExp(`^/${action.name}$`);
      if (pathToMatch.match(matcher)) return action.name;
    }
  }

  async buildResponse(response: Object, status = 200) {
    return new Response(JSON.stringify(response, null, 2), {
      status,
      headers: commonHeaders,
    });
  }

  async buildError(error: Error, status = 500): Promise<Response> {
    return new Response(
      JSON.stringify({
        error: { error: error.message, stack: error.stack },
      }) + "\n",
      {
        status,
        headers: commonHeaders,
      },
    );
  }
}
