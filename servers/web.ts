import { Server } from "../classes/Server";
import { config } from "../config";
import { logger } from "../api";
import { Connection } from "../classes/Connection";

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
      `starting web server @ ${config.server.web.host}:${config.server.web.port}`
    );

    this.server = Bun.serve({
      port: config.server.web.port,
      hostname: config.server.web.host,
      fetch: async (request) => this.fetch(request),
      error: async (error) => this.buildError(error),
    });
  }

  async stop() {
    if (this.server) {
      this.server.stop();
      while (
        this.server.pendingRequests > 0 ||
        this.server.pendingWebSockets > 0
      ) {
        await Bun.sleep(1000);
        logger.info(`waiting for web server shutdown...`, {
          pendingRequests: this.server.pendingRequests,
          pendingWebSockets: this.server.pendingWebSockets,
        });
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    if (!this.server) throw new Error("server not started");

    const ipAddress = this.server.requestIP(request)?.address || "unknown";
    const contentType = request.headers.get("content-type") || "";

    let params: FormData;
    try {
      params = await request.formData();
    } catch {
      params = new FormData();
    }

    const connection = new Connection(this.name, ipAddress);

    // TODO: fork for files vs actions
    const { response, error } = await connection.act(
      "foo",
      params,
      request.method,
      request.url
    );

    return error ? this.buildError(error) : this.buildResponse(response);
  }

  async buildResponse(response: Object, status = 200) {
    return new Response(JSON.stringify(response, null, 2), {
      status,
      headers: commonHeaders,
    });
  }

  async buildError(error: Error): Promise<Response> {
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
      }) + "\n",
      {
        status: 500,
        headers: commonHeaders,
      }
    );
  }
}
