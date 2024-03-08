import { logger, api } from "../api";
import { Initializer } from "../classes/Initializer";
import { config } from "../config";

const namespace = "signals";
const successExitCode = 0;
const errorExitCode = 1;

declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<Signals["initialize"]>>;
  }
}

export class Signals extends Initializer {
  constructor() {
    super(namespace);
    this.loadPriority = 1;
  }

  async initialize() {
    process.once("SIGINT", async () => {
      await this.shuDown("SIGINT");
    });

    process.once("SIGKILL", async () => {
      await this.shuDown("SIGKILL");
    });
  }

  async shuDown(signal: string) {
    logger.warn(`Received ${signal}, shutting down...`);
    const timeout = setTimeout(this.onTimeout, config.process.shutdownTimeout);
    await api.stop();
    clearTimeout(timeout);
    logger.warn("Bye!");
    process.exit(successExitCode);
  }

  async onTimeout() {
    logger.fatal(
      `Shutdown timeout reached after ${config.process.shutdownTimeout}ms, force-exiting now`,
    );
    process.exit(errorExitCode);
  }
}
