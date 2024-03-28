import { api, Action, type ActionParams } from "../api";
import { HTTP_METHOD } from "../classes/Action";
import { hashPassword, serializeUser } from "../ops/UserOps";
import { users } from "../schema/users";
import { ensureString } from "../util/formatters";

export class UserCreate implements Action {
  name = "userCreate";
  web = { route: "/user", method: HTTP_METHOD.PUT };
  inputs = {
    name: {
      required: true,
      validator: (p: string) =>
        p.length < 3 ? "Name must be at least 3 characters" : true,
      formatter: ensureString,
    },
    email: {
      required: true,
      validator: (p: string) =>
        p.length < 3 || !p.includes("@") ? "Email invalid" : true,
      formatter: ensureString,
    },
    password: {
      required: true,
      validator: (p: string) =>
        p.length < 3 ? "Password must be at least 3 characters" : true,
      formatter: ensureString,
    },
  };

  async run(params: ActionParams<UserCreate>) {
    const user = (
      await api.db.db
        .insert(users)
        .values({
          name: params.name,
          email: params.email,
          password_hash: await hashPassword(params.password),
        })
        .returning()
    )[0];

    return serializeUser(user);
  }
}
