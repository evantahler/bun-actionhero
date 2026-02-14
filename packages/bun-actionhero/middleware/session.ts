import type { ActionMiddleware } from "../classes/Action";
import type { Connection } from "../classes/Connection";
import { ErrorType, TypedError } from "../classes/TypedError";

export const SessionMiddleware: ActionMiddleware = {
  runBefore: async (_params, connection: Connection) => {
    const data = connection.session?.data as Record<string, unknown> | undefined;
    if (!connection.session || !data?.userId) {
      throw new TypedError({
        message: "Session not found",
        type: ErrorType.CONNECTION_SESSION_NOT_FOUND,
      });
    }
  },
};
