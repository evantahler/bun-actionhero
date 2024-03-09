import type { Inputs } from "./Inputs";
import type { Connection } from "./Connection";

const defaultName = "__action";
const defaultDescription = "__description";

export abstract class Action {
  name = defaultName;
  description = defaultDescription;
  inputs: Inputs = {};

  constructor() {
    if (this.description == defaultDescription) this.description = this.name;
  }

  /**
   * The main "do something" method for this action.  It can be `async`.  Usually the goal of this run method is to return the data that you want to be sent to API consumers.  If error is thrown in this method, it will be logged, caught, and returned to the client as `error`
   */
  abstract run(
    params: ActionParams<this>,
    connection: Connection
  ): Promise<Object>;

  async validate() {
    if (!this.name) throw new Error("Action name is required");
    if (!this.description) throw new Error("Action description is required");
  }
}

export type ActionParams<A extends Action> = {
  [K in keyof A["inputs"]]: A["inputs"][K]["formatter"] extends (
    ...p: any
  ) => any
    ? ReturnType<A["inputs"][K]["formatter"]>
    : A["inputs"][K]["formatter"] extends (p: any) => any
      ? ReturnType<A["inputs"][K]["formatter"]>
      : string;
};
