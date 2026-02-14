import { existsSync } from "fs";
import path from "path";
import { api, RUN_MODE } from "../api";
import { Initializer } from "../classes/Initializer";
import type { Server } from "../classes/Server";
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
    const servers: Server<any>[] = [];

    // Load framework servers
    const frameworkServersDir = path.join(api.frameworkDir, "servers");
    const frameworkServers = await globLoader<Server<any>>(frameworkServersDir);
    servers.push(...frameworkServers);

    // Load user-app servers
    const userServersDir = path.join(api.rootDir, "servers");
    if (existsSync(userServersDir)) {
      const userServers = await globLoader<Server<any>>(userServersDir);
      servers.push(...userServers);
    }

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
