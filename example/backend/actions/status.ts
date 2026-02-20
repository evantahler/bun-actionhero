import { Action, api } from "keryx";
import { HTTP_METHOD } from "keryx/classes/Action.ts";
import { z } from "zod";
import pkg from "../package.json";

export class Status implements Action {
  name = "status";
  description =
    "Returns server health and runtime information including the server name, process ID, package version, uptime in milliseconds, and memory consumption in MB. Does not require authentication.";
  inputs = z.object({});
  web = { route: "/status", method: HTTP_METHOD.GET };

  async run() {
    const consumedMemoryMB =
      Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100;

    return {
      name: api.process.name,
      pid: api.process.pid,
      version: pkg.version,
      uptime: new Date().getTime() - api.bootTime,
      consumedMemoryMB,
    };
  }
}
