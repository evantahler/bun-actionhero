import { logger } from "../api";
import { Initializer } from "../classes/Initializer";

export class Name extends Initializer {
  constructor() {
    super("name");
    this.loadPriority = 1;
  }

  async initialize() {
    const name = "PROCESS_NAME";
    logger.info(`Process Name: ${name}`);
  }
}
