import type { Inputs } from "./Inputs";
import type { Connection } from "./Connection";
import type { Input } from "./Input";

export const httpMethods = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "OPTIONS",
] as const;
export type HTTP_METHOD = (typeof httpMethods)[number];

export type ActionConstructorInputs = {
  name: string;
  description?: string;
  inputs?: Inputs;
  web?: {
    route?: RegExp | string;
    method?: HTTP_METHOD;
  };
};

export abstract class Action {
  name: string;
  description: string;
  inputs: Inputs;
  web: {
    route: RegExp | string;
    method: HTTP_METHOD;
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
   * The main "do something" method for this action.
   * It can be `async`.
   * Usually the goal of this run method is to return the data that you want to be sent to API consumers.
   * If error is thrown in this method, it will be logged, caught, and returned to the client as `error`
   */
  abstract run(
    params: ActionParams<typeof this>,
    connection: Connection, // ): ActionResponse<typeof this>;
  ): Promise<any>;

  async validate() {
    if (!this.name) throw new Error("Action name is required");
    if (!this.description) throw new Error("Action description is required");
  }
}

export type ActionParams<A extends Action> = {
  [k in keyof A["inputs"]]: TypeFromFormatterOrUnknown<A["inputs"][k]>;
};
type TypeFromFormatterOrUnknown<I extends Input> = I["formatter"] extends (
  a: any,
) => any
  ? ReturnType<I["formatter"]>
  : unknown;

export type ActionResponse<A extends Action> = Awaited<ReturnType<A["run"]>> &
  Partial<{
    error?: { message: string; stack?: string };
  }>;
