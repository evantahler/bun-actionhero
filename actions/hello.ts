import { Action, type ActionParams } from "../api";
import { ensureNumber } from "../util/formatters";

export class Hello extends Action {
  constructor() {
    super({
      name: "hello",
      web: { route: "/hello", method: "POST" },
      inputs: {
        name: { required: true },
        number: {
          required: true,
          default: 42,
          formatter: ensureNumber,
        },
      },
    });
  }

  async run(params: ActionParams<Hello>) {
    return { message: `Hello, ${params.name} (${params.number})!` };
  }
}
