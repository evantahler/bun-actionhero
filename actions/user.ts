import { eq } from "drizzle-orm";
import { api, Action, type ActionParams, Connection } from "../api";
import { HTTP_METHOD } from "../classes/Action";
import { hashPassword, serializeUser } from "../ops/UserOps";
import { users } from "../schema/users";
import { ensureString } from "../util/formatters";
import {
  emailValidator,
  nameValidator,
  passwordValidator,
} from "../util/validators";
import { ErrorType, TypedError } from "../classes/TypedError";

export class UserCreate implements Action {
  name = "user:create";
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
      secret: true,
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

    return { user: await serializeUser(user) };
  }
}

export class UserEdit implements Action {
  name = "user:edit";
  web = { route: "/user", method: HTTP_METHOD.POST };
  inputs = {
    name: {
      required: false,
      validator: nameValidator,
      formatter: ensureString,
    },
    email: {
      required: false,
      validator: emailValidator,
      formatter: ensureString,
    },
    password: {
      required: false,
      validator: passwordValidator,
      formatter: ensureString,
      secret: true,
    },
  };

  async run(params: ActionParams<UserEdit>, connection: Connection) {
    if (!connection?.session?.data.userId) {
      throw new TypedError({
        message: "User not found",
        type: ErrorType.CONNECTION_ACTION_RUN,
      });
    }

    const { name, email, password } = params;
    const updates = {} as Record<string, string>;
    if (name) updates.name = name;
    if (email) updates.email = email.toLowerCase();
    if (password) updates.password_hash = await hashPassword(password);

    const [user] = await api.db.db
      .update(users)
      .set(updates)
      .where(eq(users.id, connection.session.data.userId))
      .returning();

    return { user: await serializeUser(user) };
  }
}
