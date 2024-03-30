import { api, Action, type ActionParams } from "../api";
import { HTTP_METHOD } from "../classes/Action";
import { hashPassword, serializeUser } from "../ops/UserOps";
import { users } from "../schema/users";
import { ensureString } from "../util/formatters";
import {
  emailValidator,
  nameValidator,
  passwordValidator,
} from "../util/validators";

export class UserCreate implements Action {
  name = "userCreate";
  web = { route: "/user", method: HTTP_METHOD.PUT };
  inputs = {
    name: {
      required: true,
      validator: nameValidator,
      formatter: ensureString,
    },
    email: {
      required: true,
      validator: emailValidator,
      formatter: ensureString,
    },
    password: {
      required: true,
      validator: passwordValidator,
      formatter: ensureString,
    },
  };

  async run(params: ActionParams<UserCreate>) {
    const [user] = await api.db.db
      .insert(users)
      .values({
        name: params.name,
        email: params.email.toLowerCase(),
        password_hash: await hashPassword(params.password),
      })
      .returning();

    return serializeUser(user);
  }
}
