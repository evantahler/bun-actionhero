import { Action, type ActionParams } from "../classes/Action";
import { ensureNumber } from "../util/formatters";

export class Hello extends Action {
  constructor() {
    super();

    this.name = "hello";
    this.apiRoute = "/hello";
    this.inputs = {
      name: { required: true },
      number: {
        required: true,
        default: 42,
        formatter: ensureNumber,
      },
    };
  }

  async run(params: ActionParams<Hello>) {
    return { message: `Hello, ${params.name} (${params.number})!` };
  }
}
