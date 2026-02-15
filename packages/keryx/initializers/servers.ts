import { existsSync } from "fs";
import path from "path";
import { api, RUN_MODE } from "../index";
import { Initializer } from "../classes/Initializer";
import type { Server } from "../classes/Server";
import { config } from "../config";
import { globLoader } from "../util/glob";

const namespace = "servers";

declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<Servers["initialize"]>>;
  }
}

export class Servers extends Initializer {
  constructor() {
    super(namespace);
    this.loadPriority = 800;
    this.startPriority = 550;
    this.stopPriority = 100;
    this.runModes = [RUN_MODE.SERVER];
  }

  async initialize() {
    // Load framework built-in servers
    const frameworkServers = await globLoader<Server<any>>(
      path.join(api.frameworkDir, "servers"),
    );

    // Load user project servers (if directory exists)
    const userServerDir = path.join(api.rootDir, config.paths.servers);
    const userServers = existsSync(userServerDir)
      ? await globLoader<Server<any>>(userServerDir)
      : [];

    const servers = [...frameworkServers, ...userServers];

    for (const server of servers) {
      await server.initialize();
    }

    return { servers };
  }

  async start() {
    const { servers } = api[namespace];

    for (const server of servers) {
      await server.start();
    }
  }

  async stop() {
    const { servers } = api[namespace];

    for (const server of servers) {
      await server.stop();
    }
  }
}
