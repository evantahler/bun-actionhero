import { logger } from "../api";
import { Initializer } from "../classes/Initializer";
import { config } from "../config";

const namespace = "name";

declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<Name["initialize"]>>;
  }
}

export class Name extends Initializer {
  constructor() {
    super(namespace);
    this.loadPriority = 1;
  }

  async initialize() {
    const name = config.name.name;
    const pid = process.pid;
    logger.info(`Initializing process: ${name}, pid: ${pid}`);
    return { name, pid };
  }
}
