import { eq } from "drizzle-orm";
import { api, type Action, type ActionParams, Connection } from "../api";
import { users } from "../schema/users";
import { ensureString } from "../util/formatters";
import { emailValidator, passwordValidator } from "../util/validators";
import { serializeUser, checkPassword } from "../ops/UserOps";
import { ErrorType, TypedError } from "../classes/TypedError";
import { HTTP_METHOD } from "../classes/Action";
import type { SessionData } from "../initializers/session";
import { SessionMiddleware } from "../middleware/session";

export type SessionImpl = { userId?: number };

export class SessionCreate implements Action {
  name = "session:create";
  description = "Create a session";
  web = { route: "/session", method: HTTP_METHOD.PUT };
  inputs = {
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

  // @ts-ignore - this is a valid action and response type, but sometimes the compiler doesn't like it
  run = async (
    params: ActionParams<SessionCreate>,
    connection: Connection<SessionImpl>,
  ): Promise<{
    user: Awaited<ReturnType<typeof serializeUser>>;
    session: SessionData<SessionImpl>;
  }> => {
    const [user] = await api.db.db
      .select()
      .from(users)
      .where(eq(users.email, params.email.toLowerCase()));

    if (!user) {
      throw new TypedError({
        message: "User not found",
        type: ErrorType.CONNECTION_ACTION_RUN,
      });
    }

    const passwordMatch = await checkPassword(user, params.password);
    if (!passwordMatch) {
      throw new TypedError({
        message: "Password does not match",
        type: ErrorType.CONNECTION_ACTION_RUN,
      });
    }

    await connection.updateSession({ userId: user.id });

    return {
      user: serializeUser(user),
      session: connection.session!,
    };
  };
}

export class SessionDestroy implements Action {
  name = "session:destroy";
  description = "Destroy a session";
  web = { route: "/session", method: HTTP_METHOD.DELETE };
  middleware = [SessionMiddleware];
  inputs = {};

  async run(
    params: ActionParams<SessionDestroy>,
    connection: Connection<SessionImpl>,
  ) {
    await api.session.destroy(connection);
    return { success: true };
  }
}
