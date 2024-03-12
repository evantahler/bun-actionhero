import { api, Action } from "../api";
import packageJSON from "../package.json";

export class Status extends Action {
  constructor() {
    super({
      name: "status",
      web: { route: "/status", method: "GET" },
    });
  }

  async run() {
    const consumedMemoryMB =
      Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100;

    return {
      name: api.process.name,
      pid: api.process.pid,
      version: packageJSON.version,
      uptime: new Date().getTime() - api.bootTime,
      consumedMemoryMB,
    };
  }
}
