import { api, Action, type ActionParams } from "../api";
import { hashPassword, serializeUser } from "../ops/UserOps";
import { users } from "../schema/users";
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
            p.length < 3 || !p.includes("@") ? "Email invalid" : undefined,
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
    console.log("userCreate", params);

    const user = (
      await api.drizzle.db
        .insert(users)
        .values({
          name: params.name,
          email: params.email,
          password_hash: await hashPassword(params.password),
        })
        .returning()
    )[0];

    console.log(params, user);
    return serializeUser(user);
  }
}
