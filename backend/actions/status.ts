import { z } from "zod";
import { Action, api } from "../api";
import { HTTP_METHOD } from "../classes/Action";
import packageJSON from "../package.json";

export class Status implements Action {
  name = "status";
  description = "Return the status of the server";
  inputs = z.object({});
  web = { route: "/status", method: HTTP_METHOD.GET };

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
