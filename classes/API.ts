import path from "path";
import { config } from "../config";
import { globLoader } from "../util/glob";
import type { Initializer, InitializerSortKeys } from "./Initializer";
import { Logger } from "./Logger";

export class API {
  rootDir: string;
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
    this.rootDir = path.join(import.meta.path, "..", "..");
    this.logger = new Logger(config.logger);

    this.initialized = false;
    this.started = false;
    this.stopped = false;

    this.initializers = [];
  }

  async initialize() {
    this.logger.warn("Initializing process");
    this.initialized = false;

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
    this.logger.warn("Initializing complete");
  }

  async start() {
    this.stopped = false;
    this.started = false;
    if (!this.initialized) await this.initialize();

    this.logger.warn("Starting process");

    this.sortInitializers("startPriority");

    for (const initializer of this.initializers) {
      this.logger.debug(`Starting initializer ${initializer.name}`);
      const response = await initializer.start?.();
      this.logger.debug(`Started initializer ${initializer.name}`);
    }

    this.started = true;
    this.logger.warn("Starting complete");
  }

  async stop() {
    if (this.stopped) return;

    this.logger.warn("Stopping process");

    this.sortInitializers("stopPriority");

    for (const initializer of this.initializers) {
      this.logger.debug(`Stopping initializer ${initializer.name}`);
      await initializer.stop?.();
      this.logger.debug(`Stopped initializer ${initializer.name}`);
    }

    this.stopped = true;
    this.started = false;
    this.logger.warn("Stopping complete");
  }

  private async findInitializers() {
    const initializers = await globLoader<Initializer>("initializers");
    for (const i of initializers) {
      this.initializers.push(i);
    }
  }

  private sortInitializers(key: InitializerSortKeys) {
    this.initializers.sort((a, b) => a[key] - b[key]);
  }
}
