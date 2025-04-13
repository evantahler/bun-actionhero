import { SessionImpl } from "../actions/session";
import { Connection } from "../api";
import { ActionMiddleware } from "../classes/Action";
import { ErrorType, TypedError } from "../classes/TypedError";

export const SessionMiddleware: ActionMiddleware = {
  runBefore: async (params, connection: Connection<SessionImpl>) => {
    if (!connection.session || !connection.session.data.userId) {
      throw new TypedError({
        message: "Session not found",
        type: ErrorType.CONNECTION_SESSION_NOT_FOUND,
      });
    }
  },
};
