import { Action, type ActionParams } from "../api";
import { ensureString } from "../util/formatters";

export class Hello extends Action {
  constructor() {
    super({
      name: "hello",
      web: { route: "/hello", method: "POST" },
      inputs: {
        name: {
          required: true,
          validator: (p) => p.length > 0,
          formatter: ensureString,
        },
      },
    });
  }

  async run(params: ActionParams<Hello>) {
    return { message: `Hello, ${params.name}!` };
  }
}
