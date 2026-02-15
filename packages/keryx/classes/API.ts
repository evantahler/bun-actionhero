import { existsSync } from "fs";
import path from "path";
import { config } from "../config";
import { globLoader } from "../util/glob";
import type { Initializer, InitializerSortKeys } from "./Initializer";
import { Logger } from "./Logger";
import { ErrorType, TypedError } from "./TypedError";

export enum RUN_MODE {
  CLI = "cli",
  SERVER = "server",
}

let flapPreventer = false;

export class API {
  /** The framework's own directory (resolved from import.meta). Contains built-in initializers, actions, servers. */
  frameworkDir: string;
  /** The user's project root (process.cwd()). Contains user's actions, initializers, config, etc. */
  rootDir: string;
  initialized: boolean;
  started: boolean;
  stopped: boolean;
  bootTime: number;
  logger: Logger;
  runMode!: RUN_MODE;
  initializers: Initializer[];

  // allow arbitrary properties to be set on the API, to be added and typed later
  [key: string]: any;

  constructor() {
    this.bootTime = new Date().getTime();
    this.frameworkDir = path.join(import.meta.path, "..", "..");
    this.rootDir = process.cwd();
    this.logger = new Logger(config.logger);

    this.initialized = false;
    this.started = false;
    this.stopped = false;

    this.initializers = [];
  }

  async initialize() {
    this.logger.warn("--- \uD83D\uDD04  Initializing process ---");
    this.initialized = false;

    await this.findInitializers();
    this.sortInitializers("loadPriority");

    for (const initializer of this.initializers) {
      try {
        this.logger.debug(`Initializing initializer ${initializer.name}`);
        const response = await initializer.initialize?.();
        if (response) this[initializer.name] = response;
        this.logger.debug(`Initialized initializer ${initializer.name}`);
      } catch (e) {
        throw new TypedError({
          message: `${e}`,
          type: ErrorType.SERVER_INITIALIZATION,
          originalError: e,
        });
      }
    }

    this.initialized = true;
    this.logger.warn("--- \uD83D\uDD04  Initializing complete ---");
  }

  async start(runMode: RUN_MODE = RUN_MODE.SERVER) {
    this.stopped = false;
    this.started = false;
    this.runMode = runMode;
    if (!this.initialized) await this.initialize();

    this.logger.warn("--- \uD83D\uDD3C  Starting process ---");

    this.sortInitializers("startPriority");

    for (const initializer of this.initializers) {
      if (!initializer.runModes.includes(runMode)) {
        this.logger.debug(
          `Not starting initializer ${initializer.name} in ${runMode} mode`,
        );
        continue;
      }

      try {
        this.logger.debug(`Starting initializer ${initializer.name}`);
        await initializer.start?.();
        this.logger.debug(`Started initializer ${initializer.name}`);
      } catch (e) {
        throw new TypedError({
          message: `${e}`,
          type: ErrorType.SERVER_START,
          originalError: e,
        });
      }
    }

    this.started = true;
    this.logger.warn("--- \uD83D\uDD3C  Starting complete ---");
  }

  async stop() {
    if (this.stopped) {
      this.logger.warn("API is already stopped");
      return;
    }

    this.logger.warn("--- \uD83D\uDD3D  Stopping process ---");

    this.sortInitializers("stopPriority");

    for (const initializer of this.initializers) {
      try {
        this.logger.debug(`Stopping initializer ${initializer.name}`);
        await initializer.stop?.();
        this.logger.debug(`Stopped initializer ${initializer.name}`);
      } catch (e) {
        throw new TypedError({
          message: `${e}`,
          type: ErrorType.SERVER_STOP,
          originalError: e,
        });
      }
    }

    this.stopped = true;
    this.started = false;
    this.logger.warn("--- \uD83D\uDD3D  Stopping complete ---");
  }

  async restart() {
    if (flapPreventer) return;

    flapPreventer = true;
    await this.stop();
    await this.start();
    flapPreventer = false;
  }

  private async findInitializers() {
    // Load framework built-in initializers
    const frameworkInitializerDir = path.join(
      this.frameworkDir,
      "initializers",
    );
    const frameworkInitializers =
      await globLoader<Initializer>(frameworkInitializerDir);

    // Load user project initializers (if directory exists)
    const userInitializerDir = path.join(
      this.rootDir,
      config.paths.initializers,
    );
    const userInitializers = existsSync(userInitializerDir)
      ? await globLoader<Initializer>(userInitializerDir)
      : [];

    for (const i of [...frameworkInitializers, ...userInitializers]) {
      this.initializers.push(i);
    }
  }

  private sortInitializers(key: InitializerSortKeys) {
    this.initializers.sort((a, b) => a[key] - b[key]);
  }
}
