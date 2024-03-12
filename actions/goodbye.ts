import { Action, type ActionParams } from "../api";

export class Hello extends Action {
  constructor() {
    super({
      name: "goodbye",
      web: { route: "/goodbye", method: "POST" },
      inputs: { name: { required: false } },
    });
  }

  async run(params: ActionParams<Hello>) {
    return { message: `Bye${params.name ? `, ${params.name}` : ""}` };
  }
}
