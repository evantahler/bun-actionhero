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
import { ensureSession } from "../util/session";

export class UserCreate implements Action {
  name = "user:create";
  description = "Create a new user";
  web = { route: "/user", method: HTTP_METHOD.PUT };
  inputs = {
    name: {
      required: true,
      validator: nameValidator,
      formatter: ensureString,
      description: "The user's name",
    },
    email: {
      required: true,
      validator: emailValidator,
      formatter: ensureString,
      description: "The user's email",
    },
    password: {
      required: true,
      validator: passwordValidator,
      formatter: ensureString,
      secret: true,
      description: "The user's password",
    },
  };

  async run(params: ActionParams<UserCreate>) {
    const [existingUser] = await api.db.db
      .select()
      .from(users)
      .where(eq(users.email, params.email.toLowerCase()))
      .limit(1);

    if (existingUser) {
      throw new TypedError({
        message: "User already exists",
        type: ErrorType.ACTION_VALIDATION,
      });
    }

    const [user] = await api.db.db
      .insert(users)
      .values({
        name: params.name,
        email: params.email.toLowerCase(),
        password_hash: await hashPassword(params.password),
      })
      .returning();

    return { user: serializeUser(user) };
  }
}

export class UserEdit implements Action {
  name = "user:edit";
  description = "Edit an existing user";
  web = { route: "/user", method: HTTP_METHOD.POST };
  inputs = {
    name: {
      required: false,
      validator: nameValidator,
      formatter: ensureString,
      description: "The user's name",
    },
    email: {
      required: false,
      validator: emailValidator,
      formatter: ensureString,
      description: "The user's email",
    },
    password: {
      required: false,
      validator: passwordValidator,
      formatter: ensureString,
      secret: true,
      description: "The user's password",
    },
  };

  async run(params: ActionParams<UserEdit>, connection: Connection) {
    ensureSession(connection, "userId");

    const { name, email, password } = params;
    const updates = {} as Record<string, string>;
    if (name) updates.name = name;
    if (email) updates.email = email.toLowerCase();
    if (password) updates.password_hash = await hashPassword(password);

    const [user] = await api.db.db
      .update(users)
      .set(updates)
      .where(eq(users.id, connection.session?.data.userId))
      .returning();

    return { user: serializeUser(user) };
  }
}

export class UserView implements Action {
  name = "user:view";
  description = "View yourself";
  web = { route: "/user", method: HTTP_METHOD.GET };
  inputs = {};

  async run(params: ActionParams<UserView>, connection: Connection) {
    ensureSession(connection, "userId");

    const [user] = await api.db.db
      .select()
      .from(users)
      .where(eq(users.id, connection.session?.data.userId))
      .limit(1);

    return { user: serializeUser(user) };
  }
}
