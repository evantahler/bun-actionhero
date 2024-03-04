import { Initializer } from "../classes/Initializer";

export class Pid extends Initializer {
  constructor() {
    super("pid");
    this.loadPriority = 2;
  }

  async initialize() {}
}
