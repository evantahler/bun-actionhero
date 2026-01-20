import { eq } from "drizzle-orm";
import { z } from "zod";
import { Action, type ActionParams, api, Connection } from "../api";
import { HTTP_METHOD } from "../classes/Action";
import { ErrorType, TypedError } from "../classes/TypedError";
import { SessionMiddleware } from "../middleware/session";
import {
  hashPassword,
  serializePublicUser,
  serializeUser,
} from "../ops/UserOps";
import { users } from "../schema/users";
import { secret, zUserIdOrModel } from "../util/zodMixins";

export class UserCreate implements Action {
  name = "user:create";
  description = "Create a new user";
  web = { route: "/user", method: HTTP_METHOD.PUT };
  inputs = z.object({
    name: z
      .string()
      .min(3, "This field is required and must be at least 3 characters long")
      .max(256, "Name must be less than 256 characters")
      .describe("The user's name"),
    email: z
      .string()
      .min(3, "This field is required and must be at least 3 characters long")
      .refine(
        (val) => val.includes("@") && val.includes("."),
        "This is not a valid email",
      )
      .transform((val) => val.toLowerCase())
      .describe("The user's email"),
    password: secret(
      z
        .string()
        .min(8, "Password must be at least 8 characters")
        .max(256, "Password must be less than 256 characters")
        .describe("The user's password"),
    ),
  });

  async run(params: ActionParams<UserCreate>) {
    const [existingUser] = await api.db.db
      .select()
      .from(users)
      .where(eq(users.email, params.email))
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
        email: params.email,
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
  middleware = [SessionMiddleware];
  inputs = z.object({
    name: z.string().min(1).max(256).optional(),
    email: z.string().email().toLowerCase().optional(),
    password: secret(z.string().min(8).max(256).optional()),
  });

  async run(params: ActionParams<UserEdit>, connection: Connection) {
    const { name, email, password } = params;
    const updates = {} as Record<string, string>;
    if (name) updates.name = name;
    if (email) updates.email = email;
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
  description = "View a user";
  middleware = [SessionMiddleware];
  web = { route: "/user/:user", method: HTTP_METHOD.GET };
  inputs = z.object({
    user: zUserIdOrModel(),
  });

  async run(params: ActionParams<UserView>) {
    // params.user is already a resolved User object
    return { user: serializePublicUser(params.user) };
  }
}
