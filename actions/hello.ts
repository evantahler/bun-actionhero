import { Action, type ActionParams } from "../api";
import { HTTP_METHOD } from "../classes/Action";
import { ensureString } from "../util/formatters";
import { nameValidator } from "../util/validators";

export class Hello implements Action {
  name = "hello";
  web = { route: "/hello", method: HTTP_METHOD.POST };
  inputs = {
    name: {
      required: true,
      validator: nameValidator,
      formatter: ensureString,
    },
  };

  async run(params: ActionParams<Hello>) {
    return { message: `Hello, ${params.name}!` };
  }
}
