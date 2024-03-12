import type { Inputs } from "./Inputs";
import type { Connection } from "./Connection";
import type { Input } from "./Input";

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
] as const;

export type ActionConstructorInputs = {
  name: string;
  description?: string;
  inputs?: Inputs;
  web?: {
    route?: RegExp | string;
    method?: (typeof HTTP_METHODS)[number];
  };
};

export abstract class Action {
  name: string;
  description: string;
  inputs: Inputs;
  web: {
    route: RegExp | string;
    method: (typeof HTTP_METHODS)[number];
  };

  constructor(args: ActionConstructorInputs) {
    this.name = args.name;
    this.description = args.description ?? `An Action: ${this.name}`;
    this.inputs = args.inputs ?? ({} as Inputs);
    this.web = {
      route: args.web?.route ?? `/${this.name}`,
      method: args.web?.method ?? "GET",
    };
  }

  /**
   * The main "do something" method for this action.  It can be `async`.  Usually the goal of this run method is to return the data that you want to be sent to API consumers.  If error is thrown in this method, it will be logged, caught, and returned to the client as `error`
   */
  abstract run<T extends Action>(
    params: ActionParams<T>,
    connection: Connection
  ): Promise<ActionResponse<T>>;

  async validate() {
    if (!this.name) throw new Error("Action name is required");
    if (!this.description) throw new Error("Action description is required");
  }
}

export type ActionParams<A extends Action> = A["inputs"] extends Inputs
  ? {
      [k in keyof A["inputs"]]: TypeFromFormatterOrUnknown<A["inputs"][k]>;
    }
  : Record<string, unknown>;
type TypeFromFormatterOrUnknown<I extends Input> = I["formatter"] extends (
  ...args: any
) => any
  ? ReturnType<I["formatter"]>
  : string;

export type ActionResponse<A extends Action> = Awaited<ReturnType<A["run"]>> & {
  error?: { message: string; stack?: string };
};
