import { Server } from "../classes/Server";
import { config } from "../config";
import { logger } from "../api";

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
      fetch(req) {
        return new Response("404!");
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
        await Bun.sleep(1000);
        logger.info(`waiting for web server shutdown...`, {
          pendingRequests: this.server.pendingRequests,
          pendingWebSockets: this.server.pendingWebSockets,
        });
      }
    }
  }
}
