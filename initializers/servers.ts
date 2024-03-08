import { api } from "../api";
import { Initializer } from "../classes/Initializer";
import type { Server } from "../classes/Server";
import { WebServer } from "../servers/web";

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
  }

  async initialize() {
    const servers: Server<any>[] = [];

    const webServer = new WebServer();
    servers.push(webServer);

    return { servers };
  }

  async start() {
    const { servers } = api[namespace];

    for (const server of servers) {
      await server.start();
    }
  }
}
