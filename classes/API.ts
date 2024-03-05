import { Glob } from "bun";
import path from "path";
import { config } from "../config";
import type { Initializer, InitializerSortKeys } from "./Initializer";
import { Logger } from "./Logger";

export class API {
  initialized: boolean;
  started: boolean;
  stopped: boolean;
  bootTime: number;
  logger: Logger;
  initializers: Initializer[];

  // allow arbitrary properties to be set on the API, to be added and typed later
  [key: string]: any;

  constructor() {
    this.bootTime = new Date().getTime();
    this.logger = this.buildLogger();

    this.initialized = false;
    this.started = false;
    this.stopped = false;

    this.initializers = [];
  }

  async initialize() {
    this.logger.info("Initializing process");

    await this.findInitializers();
    this.sortInitializers("loadPriority");

    for (const initializer of this.initializers) {
      this.logger.debug(`Initializing initializer ${initializer.name}`);
      await initializer.validate();
      const response = await initializer.initialize?.();
      if (response) this[initializer.name] = response;
      this.logger.debug(`Initialized initializer ${initializer.name}`);
    }

    this.initialized = true;
    this.logger.info("Initializing complete");
  }

  async start() {
    if (!this.initialized) await this.initialize();

    this.logger.info("Starting process");

    this.sortInitializers("startPriority");

    for (const initializer of this.initializers) {
      this.logger.debug(`Starting initializer ${initializer.name}`);
      const response = await initializer.start?.();
      this.logger.debug(`Started initializer ${initializer.name}`);
    }

    this.started = true;
    this.logger.info("Starting complete");
  }

  async stop() {
    this.logger.info("Stopping process");

    this.sortInitializers("stopPriority");

    for (const initializer of this.initializers) {
      this.logger.debug(`Stopping initializer ${initializer.name}`);
      await initializer.start?.();
      this.logger.debug(`Stopped initializer ${initializer.name}`);
    }

    this.stopped = true;
    this.logger.info("Stopping complete");
  }

  private buildLogger() {
    return new Logger(config.logger);
  }

  private async findInitializers() {
    const glob = new Glob("**/*.ts");
    const dir = path.join(import.meta.path, "..", "..", "initializers");

    for await (const file of glob.scan(dir)) {
      const fullPath = path.join(dir, file);
      const modules = (await import(fullPath)) as {
        [key: string]: new () => Initializer;
      };
      for (const [name, klass] of Object.entries(modules)) {
        try {
          const instance = new klass();
          this.initializers.push(instance);
        } catch (error) {
          throw new Error(`Error loading initializer ${name} - ${error}`);
        }
      }
    }
  }

  private sortInitializers(key: InitializerSortKeys) {
    this.initializers.sort((a, b) => a[key] - b[key]);
  }
}
