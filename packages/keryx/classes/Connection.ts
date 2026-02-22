import colors from "colors";
import { randomUUID } from "crypto";
import { api, logger } from "../api";
import { config } from "../config";
import type { PubSubMessage } from "../initializers/pubsub";
import type { SessionData } from "../initializers/session";
import type { RateLimitInfo } from "../middleware/rateLimit";
import { isSecret } from "../util/zodMixins";
import type { Action, ActionParams } from "./Action";
import { ErrorType, TypedError } from "./TypedError";

export class Connection<T extends Record<string, any> = Record<string, any>> {
  type: string;
  identifier: string;
  id: string;
  session?: SessionData<T>;
  subscriptions: Set<string>;
  sessionLoaded: boolean;
  rawConnection?: any;
  rateLimitInfo?: RateLimitInfo;
  correlationId?: string;

  constructor(
    type: string,
    identifier: string,
    id = randomUUID() as string,
    rawConnection: any = undefined,
  ) {
    this.type = type;
    this.identifier = identifier;
    this.id = id;
    this.sessionLoaded = false;
    this.subscriptions = new Set();
    this.rawConnection = rawConnection;

    api.connections.connections.set(this.id, this);
  }

  /**
   * Runs an action for this connection, given FormData params.
   *  Throws errors.
   */
  async act(
    actionName: string | undefined,
    params: FormData, // note: params are not constant for all connections - some are long-lived, like websockets
    method: Request["method"] = "",
    url: string = "",
  ): Promise<{ response: Object; error?: TypedError }> {
    const reqStartTime = new Date().getTime();
    let loggerResponsePrefix: "OK" | "ERROR" = "OK";
    let response: Object = {};
    let error: TypedError | undefined;

    let action: Action | undefined;
    try {
      action = this.findAction(actionName);
      if (!action) {
        throw new TypedError({
          message: `Action not found${actionName ? `: ${actionName}` : ""}`,
          type: ErrorType.CONNECTION_ACTION_NOT_FOUND,
        });
      }

      // load the session once, if it hasn't been loaded yet
      if (!this.sessionLoaded) await this.loadSession();

      let formattedParams = await this.formatParams(params, action);

      for (const middleware of action.middleware ?? []) {
        if (middleware.runBefore) {
          const middlewareResponse = await middleware.runBefore(
            formattedParams,
            this,
          );
          if (middlewareResponse && middlewareResponse?.updatedParams)
            formattedParams = middlewareResponse.updatedParams;
        }
      }

      const timeoutMs = action.timeout ?? config.actions.timeout;
      if (timeoutMs > 0) {
        const controller = new AbortController();
        const timeoutError = new TypedError({
          message: `Action '${action.name}' timed out after ${timeoutMs}ms`,
          type: ErrorType.CONNECTION_ACTION_TIMEOUT,
        });
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            controller.abort();
            reject(timeoutError);
          }, timeoutMs);
        });
        response = await Promise.race([
          action.run(formattedParams, this, controller.signal),
          timeoutPromise,
        ]);
      } else {
        response = await action.run(formattedParams, this);
      }

      for (const middleware of action.middleware ?? []) {
        if (middleware.runAfter) {
          const middlewareResponse = await middleware.runAfter(
            formattedParams,
            this,
          );
          if (middlewareResponse && middlewareResponse?.updatedResponse)
            response = middlewareResponse.updatedResponse;
        }
      }
    } catch (e) {
      loggerResponsePrefix = "ERROR";
      error =
        e instanceof TypedError
          ? e
          : new TypedError({
              message: `${e}`,
              type: ErrorType.CONNECTION_ACTION_RUN,
              originalError: e,
            });
    }

    // Note: we want the params object to remain on the same line as the message, so we stringify
    const sanitizedParams = sanitizeParams(params, action);
    const loggingParams = config.logger.colorize
      ? colors.gray(JSON.stringify(sanitizedParams))
      : JSON.stringify(sanitizedParams);

    const statusMessage = `[ACTION:${this.type.toUpperCase()}:${loggerResponsePrefix}]`;
    const messagePrefix = config.logger.colorize
      ? loggerResponsePrefix === "OK"
        ? colors.bgBlue(statusMessage)
        : colors.bgMagenta(statusMessage)
      : statusMessage;

    const duration = new Date().getTime() - reqStartTime;

    const errorStack =
      error && error.stack
        ? config.logger.colorize
          ? "\r\n" + colors.gray(error.stack)
          : "\r\n" + error.stack
        : "";

    const correlationIdTag = this.correlationId
      ? ` [cor:${this.correlationId}]`
      : "";

    logger.info(
      `${messagePrefix} ${actionName} (${duration}ms) ${method.length > 0 ? `[${method}]` : ""} ${this.identifier}${url.length > 0 ? `(${url})` : ""}${correlationIdTag} ${error ? error : ""} ${loggingParams} ${errorStack}`,
    );

    return { response, error };
  }

  async updateSession(data: Partial<T>) {
    await this.loadSession();

    if (!this.session) {
      throw new TypedError({
        message: "Session not found",
        type: ErrorType.CONNECTION_SESSION_NOT_FOUND,
      });
    }

    return api.session.update(this.session, data);
  }

  subscribe(channel: string) {
    this.subscriptions.add(channel);
  }

  unsubscribe(channel: string) {
    this.subscriptions.delete(channel);
  }

  async broadcast(channel: string, message: string) {
    if (!this.subscriptions.has(channel)) {
      throw new TypedError({
        message: "not subscribed to this channel",
        type: ErrorType.CONNECTION_NOT_SUBSCRIBED,
      });
    }

    return api.pubsub.broadcast(channel, message, this.id);
  }

  onBroadcastMessageReceived(_payload: PubSubMessage) {
    throw new Error(
      "unimplemented - this should be overwritten by connections that support it",
    );
  }

  destroy() {
    return api.connections.destroy(this.type, this.identifier, this.id);
  }

  async loadSession() {
    if (this.session) return;

    const session = await api.session.load(this);
    if (session) {
      this.session = session as SessionData<T>;
    } else {
      this.session = await api.session.create(this);
    }
    this.sessionLoaded = true;
  }

  private findAction(actionName: string | undefined) {
    return api.actions.actions.find((a: Action) => a.name === actionName);
  }

  private async formatParams(params: FormData, action: Action) {
    if (!action.inputs) return {} as ActionParams<Action>;

    // Convert FormData to a plain object for processing
    const rawParams: Record<string, any> = {};
    params.forEach((value, key) => {
      if (rawParams[key] !== undefined) {
        // If the key already exists, convert to array
        if (Array.isArray(rawParams[key])) {
          rawParams[key].push(value);
        } else {
          rawParams[key] = [rawParams[key], value];
        }
      } else {
        rawParams[key] = value;
      }
    });

    // Handle zod schema inputs
    if (
      typeof action.inputs === "object" &&
      action.inputs &&
      "safeParse" in action.inputs
    ) {
      // This is a zod schema - use safeParseAsync to support both sync and async transforms
      try {
        const result = await (action.inputs as any).safeParseAsync(rawParams);
        if (!result.success) {
          // Get the first validation error (Zod v4 uses .issues instead of .errors)
          const firstError = result.error.issues[0];
          const key = firstError.path[0];
          const value = rawParams[key];
          let message = firstError.message;
          // Zod v4: detect missing required param (code: "invalid_type" with undefined input)
          const isMissingRequired =
            firstError.code === "invalid_type" && value === undefined;
          if (isMissingRequired) {
            message = `Missing required param: ${key}`;
          }
          throw new TypedError({
            message,
            type: ErrorType.CONNECTION_ACTION_PARAM_REQUIRED,
            key,
            value,
          });
        }
        return result.data as ActionParams<Action>;
      } catch (e) {
        if (e instanceof TypedError) {
          throw e;
        }
        throw new TypedError({
          message: `Error validating params: ${e}`,
          type: ErrorType.CONNECTION_ACTION_PARAM_VALIDATION,
          originalError: e,
        });
      }
    }

    // If we get here, inputs is not a zod schema, return empty object
    return {} as ActionParams<Action>;
  }
}

const REDACTED = "[[secret]]" as const;

const sanitizeParams = (params: FormData, action: Action | undefined) => {
  const sanitizedParams: Record<string, any> = {};

  // Get secret fields from the action's zod schema if it exists
  const secretFields = new Set<string>();
  if (action?.inputs && typeof action.inputs === "object") {
    const zodSchema = action.inputs as any;
    // In Zod v4, object schemas have a .shape property with the fields
    if (zodSchema.shape) {
      for (const [fieldName, fieldSchema] of Object.entries(zodSchema.shape)) {
        if (isSecret(fieldSchema as any)) {
          secretFields.add(fieldName);
        }
      }
    }
  }

  params.forEach((v, k) => {
    if (secretFields.has(k)) {
      sanitizedParams[k] = REDACTED;
    } else {
      sanitizedParams[k] = v;
    }
  });

  return sanitizedParams;
};
