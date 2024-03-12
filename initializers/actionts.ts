import { logger } from "../api";
import type { Action } from "../classes/Action";
import { Initializer } from "../classes/Initializer";
import { globLoader } from "../util/glob";

const namespace = "actions";

declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<Actions["initialize"]>>;
  }
}

export class Actions extends Initializer {
  constructor() {
    super(namespace);
    this.loadPriority = 500;
  }

  async initialize() {
    const actions = await globLoader<Action>("actions");
    logger.info(`loaded ${Object.keys(actions).length} actions`);
    return { actions };
  }
}
