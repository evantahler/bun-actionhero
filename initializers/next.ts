import next from "next";
import type { NextServer, RequestHandler } from "next/dist/server/next";
import { Initializer } from "../classes/Initializer";
import { api, logger, RUN_MODE } from "../api";
import { config } from "../config";
import path from "node:path";
import { monkeyPatchLogging } from "../util/consoleLoggingPatches";

const namespace = "next";

declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<Next["initialize"]>>;
  }
}

/**
 * Programmatically load and start a Next.js server and attach to our web server
 */
export class Next extends Initializer {
  constructor() {
    super(namespace);
    // load and start after the webserver
    this.loadPriority = 850;
    this.startPriority = 520;
    this.runModes = [RUN_MODE.SERVER];
  }

  async initialize() {
    return {} as { app: NextServer; handle: RequestHandler };
  }

  async start() {
    if (config.next.enabled !== true) return;
    if (config.server.web.enabled !== true) return;

    monkeyPatchLogging();

    if (config.next.dev) {
      logger.info("Running next.js in development mode");
    }

    api[namespace].app = next({
      dev: config.next.dev,
      quiet: false,
      dir: path.join(__dirname, ".."),
    });

    await api[namespace].app.prepare();
    api[namespace].handle = api[namespace].app.getRequestHandler();
    logger.info("next.js server ready");
  }

  async stop() {
    if (api[namespace].app) {
      await api[namespace].app.close();
    }
  }
}
