import { api } from "../api";
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
    this.startPriority = 500;
  }

  async initialize() {
    const servers = await globLoader<Server<any>>("servers");
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
