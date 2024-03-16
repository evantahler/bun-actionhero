import { Server } from "../classes/Server";
import { config } from "../config";
import { logger, api } from "../api";
import { Connection } from "../classes/Connection";
import path from "path";
import { type HTTP_METHOD } from "../classes/Action";
import { renderToReadableStream } from "react-dom/server";
import type { BunFile } from "bun";

type URLParsed = import("url").URL;

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
      console.log("web server stopped");
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith(`${config.server.web.apiRoute}/`)) {
      return this.handleAction(request, url);
    } else if (url.pathname.startsWith(`${config.server.web.assetRoute}/`)) {
      return this.handleAsset(request, url);
    } else {
      return this.handlePage(request, url);
    }
  }

  async handleAction(request: Request, url: URLParsed) {
    if (!this.server) throw new Error("server not started");
    let errorStatusCode = 500;

    const ipAddress = this.server.requestIP(request)?.address || "unknown";
    const connection = new Connection(this.name, ipAddress);
    const actionName = await this.determineActionName(
      url,
      request.method as HTTP_METHOD,
    );
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

  async handleAsset(request: Request, url: URLParsed) {
    const requestedAsset = await this.findAsset(url);
    if (requestedAsset) {
      return new Response(requestedAsset);
    } else return this.buildError(new Error("Asset not found"), 404);
  }

  async handlePage(request: Request, url: URLParsed) {
    const [requestedAsset, assetPath, isReact] = await this.findPage(url);
    if (requestedAsset && isReact && assetPath) {
      return this.renderReactPage(request, url, assetPath);
    } else if (requestedAsset && !isReact) {
      return new Response(requestedAsset);
    } else {
      return this.buildError(new Error("Page not found"), 404);
    }
  }

  async findAsset(url: URLParsed) {
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

  async findPage(
    url: URLParsed,
  ): Promise<[BunFile | undefined, string | undefined, boolean | undefined]> {
    const replacer = new RegExp(`^${config.server.web.pageRoute}/`, "g");
    const localPath = path.join(
      api.rootDir,
      "pages",
      url.pathname.replace(replacer, ""),
    );

    const possiblePaths: [P: string, isReact: boolean][] = [
      [localPath, false],
      [localPath + ".htm", false],
      [localPath + ".html", false],
      [localPath + ".js", true],
      [localPath + ".jsx", true],
      [localPath + ".ts", true],
      [localPath + ".tsx", true],
      [localPath + "index.htm", false],
      [localPath + "index.html", false],
      [localPath + "index.js", true],
      [localPath + "index.jsx", true],
      [localPath + "index.ts", true],
      [localPath + "index.tsx", true],
    ];

    for (const [p, isReact] of possiblePaths) {
      const filePointer = Bun.file(p);
      if (await filePointer.exists()) return [filePointer, p, isReact];
    }

    return [undefined, undefined, undefined];
  }

  async determineActionName(url: URLParsed, method: HTTP_METHOD) {
    const pathToMatch = url.pathname.replace(
      new RegExp(`${config.server.web.apiRoute}`),
      "",
    );

    for (const action of api.actions.actions) {
      if (!action.web.route) continue;

      const matcher =
        action.web.route instanceof RegExp
          ? action.web.route
          : new RegExp(`^/${action.name}$`);

      if (
        pathToMatch.match(matcher) &&
        method.toUpperCase() === action.web.method
      ) {
        return action.name;
      }
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
        error: {
          message: error.message,
          stack: error.stack,
        },
      }) + "\n",
      {
        status,
        headers: commonHeaders,
      },
    );
  }

  async renderReactPage(request: Request, url: URLParsed, assetPath: string) {
    const constructors = (await import(assetPath)) as Record<
      string,
      () => React.ReactNode
    >;
    const outputStream = await renderToReadableStream(
      Object.values(constructors)[0](),
    );
    return new Response(outputStream, {
      headers: { "Content-Type": "text/html" },
    });
  }
}
