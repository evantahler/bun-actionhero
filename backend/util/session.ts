import type { Connection } from "../api";
import { ErrorType, TypedError } from "../classes/TypedError";

export function ensureSession(connection: Connection, dataMatcher: string) {
  if (!connection.session || !connection.session.data[dataMatcher]) {
    throw new TypedError({
      message: "Session not found",
      type: ErrorType.CONNECTION_SESSION_NOT_FOUND,
    });
  }
}
