import { api, Action, type ActionParams } from "../api";
import { ensureString } from "../util/formatters";

export class UserCreate extends Action {
  constructor() {
    super({
      name: "userCreate",
      web: { route: "/user", method: "PUT" },
      inputs: {
        name: {
          required: true,
          validator: (p: string) =>
            p.length < 3 ? "Name must be at least 3 characters" : undefined,
          formatter: ensureString,
        },
        email: {
          required: true,
          validator: (p: string) =>
            p.length < 3 || !p.includes("@") ? "Email invalids" : undefined,
          formatter: ensureString,
        },
        password: {
          required: true,
          validator: (p: string) =>
            p.length < 3 ? "Password must be at least 3 characters" : undefined,
          formatter: ensureString,
        },
      },
    });
  }

  async run(params: ActionParams<UserCreate>) {
    console.log(params);
  }
}
