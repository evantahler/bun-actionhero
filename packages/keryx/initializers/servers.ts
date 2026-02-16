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
    // Load framework servers from the package directory
    const frameworkServers = await globLoader<Server<any>>(
      path.join(api.packageDir, "servers"),
    );

    // Load user project servers (if rootDir differs from packageDir)
    let userServers: Server<any>[] = [];
    if (api.rootDir !== api.packageDir) {
      try {
        userServers = await globLoader<Server<any>>(
          path.join(api.rootDir, "servers"),
        );
      } catch {
        // user project may not have servers, that's fine
      }
    }

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
