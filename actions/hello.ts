import { Action } from "../classes/Action";
import type { ParamsFrom } from "../classes/Inputs";
import { ensureNumber } from "../util/formatters";

export class Hello extends Action {
  constructor() {
    super();

    this.name = "hello";
    this.inputs = {
      name: { required: true },
      number: {
        required: true,
        default: 42,
        formatter: ensureNumber,
      },
    };
  }

  async run(params: ParamsFrom<Hello>) {
    return { message: `Hello, ${params.name} (${params.number})!` };
  }
}
