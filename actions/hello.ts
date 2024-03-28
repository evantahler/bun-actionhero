import { Action, type ActionParams } from "../api";
import { HTTP_METHOD } from "../classes/Action";
import { ensureString } from "../util/formatters";

export class Hello implements Action {
  name = "hello";
  web = { route: "/hello", method: HTTP_METHOD.POST };
  inputs = {
    name: {
      required: true,
      validator: (p: string) =>
        p.length <= 0 ? "Name must be at least 1 character" : true,
      formatter: ensureString,
    },
  };

  async run(params: ActionParams<Hello>) {
    return { message: `Hello, ${params.name}!` };
  }
}
