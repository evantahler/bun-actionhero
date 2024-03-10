import { Action, type ActionParams } from "../classes/Action";

export class Hello extends Action {
  constructor() {
    super();

    this.name = "goodbye";
    this.apiRoute = "/goodbye";
    this.inputs = {
      name: { required: false },
    };
  }

  async run(params: ActionParams<Hello>) {
    return { message: `Bye${params.name ? `, ${params.name}` : ""}` };
  }
}
