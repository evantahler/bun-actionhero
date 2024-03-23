import { logger } from "../api";
import type { Action } from "../classes/Action";
import { Initializer } from "../classes/Initializer";
import { TypedError } from "../classes/TypedError";
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

    try {
      for (const action of Object.values(actions)) {
        await action.validate();
      }
    } catch (e) {
      throw new TypedError(
        `Action validation failed: ${e}`,
        "ACTION_VALIDATION",
      );
    }

    logger.info(`loaded ${Object.keys(actions).length} actions`);
    return { actions };
  }
}
