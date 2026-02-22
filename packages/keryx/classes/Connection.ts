import colors from "colors";
import { randomUUID } from "crypto";
import { api, logger } from "../api";
import { config } from "../config";
import type { PubSubMessage } from "../initializers/pubsub";
import type { SessionData } from "../initializers/session";
import type { RateLimitInfo } from "../middleware/rateLimit";
import { isSecret } from "../util/zodMixins";
import type { Action, ActionParams } from "./Action";
import { LogFormat } from "./Logger";
import { ErrorType, TypedError } from "./TypedError";

/**
 * Represents a client connection to the server — HTTP request, WebSocket, or internal caller.
 * Each connection tracks its own session, channel subscriptions, and rate-limit state.
 * The generic `T` allows typing the session data shape for your application.
 */
export class Connection<T extends Record<string, any> = Record<string, any>> {
  /** Transport type identifier (e.g., `"web"`, `"websocket"`). */
  type: string;
  /** A human-readable identifier for the connection, typically the remote IP or a session key. */
  identifier: string;
  /** Unique connection ID (UUID by default). Used as the key in `api.connections`. */
  id: string;
  /** The connection's session data, lazily loaded on first action invocation. */
  session?: SessionData<T>;
  /** Set of channel names this connection is currently subscribed to. */
  subscriptions: Set<string>;
  /** Whether the session has been loaded from Redis at least once. */
  sessionLoaded: boolean;
  /** The underlying transport handle (e.g., Bun `ServerWebSocket`). */
  rawConnection?: any;
  /** Rate-limit metadata populated by the rate-limit middleware. */
  rateLimitInfo?: RateLimitInfo;
  /** Request correlation ID for distributed tracing. Propagated from the incoming `X-Request-Id` header when `config.server.web.correlationId.trustProxy` is enabled. */
  correlationId?: string;

  /**
   * Create a new connection and register it in `api.connections`.
   *
   * @param type - Transport type (e.g., `"web"`, `"websocket"`).
   * @param identifier - Human-readable identifier, typically the remote IP address.
   * @param id - Unique connection ID. Defaults to a random UUID.
   * @param rawConnection - The underlying transport handle (e.g., Bun `ServerWebSocket`).
   */
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
   * Execute an action in the context of this connection. Handles the full lifecycle:
   * session loading, param validation via the action's Zod schema, middleware execution
   * (before/after), timeout enforcement, and structured logging.
   *
   * @param actionName - The name of the action to run. If not found, throws
   *   `ErrorType.CONNECTION_ACTION_NOT_FOUND`.
   * @param params - Raw `FormData` from the HTTP request or WebSocket message.
   *   Validated and coerced against the action's `inputs` Zod schema.
   * @param method - The HTTP method of the incoming request (used for logging).
   * @param url - The request URL (used for logging).
   * @returns The action response and optional error.
   * @throws {TypedError} With the appropriate `ErrorType` for validation, timeout, or runtime failures.
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

    logAction({
      actionName,
      connectionType: this.type,
      status: loggerResponsePrefix,
      duration: new Date().getTime() - reqStartTime,
      params: sanitizeParams(params, action),
      method,
      url,
      identifier: this.identifier,
      correlationId: this.correlationId,
      error,
    });

    return { response, error };
  }

  /**
   * Merge new data into the connection's session. Loads the session first if not yet loaded.
   *
   * @param data - Partial session data to merge into the existing session.
   * @throws {TypedError} With `ErrorType.CONNECTION_SESSION_NOT_FOUND` if no session exists.
   */
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

  /** Add a channel to this connection's subscription set. */
  subscribe(channel: string) {
    this.subscriptions.add(channel);
  }

  /** Remove a channel from this connection's subscription set. */
  unsubscribe(channel: string) {
    this.subscriptions.delete(channel);
  }

  /**
   * Publish a message to a PubSub channel. The connection must already be subscribed.
   *
   * @param channel - The channel name to broadcast to.
   * @param message - The message payload to send.
   * @throws {TypedError} With `ErrorType.CONNECTION_NOT_SUBSCRIBED` if not subscribed.
   */
  async broadcast(channel: string, message: string) {
    if (!this.subscriptions.has(channel)) {
      throw new TypedError({
        message: "not subscribed to this channel",
        type: ErrorType.CONNECTION_NOT_SUBSCRIBED,
      });
    }

    return api.pubsub.broadcast(channel, message, this.id);
  }

  /**
   * Called when a PubSub message arrives for a channel this connection is subscribed to.
   * Must be overridden by transport-specific subclasses (e.g., WebSocket connections).
   *
   * @param _payload - The incoming PubSub message.
   * @throws {Error} Always throws in the base class — subclasses must override.
   */
  onBroadcastMessageReceived(_payload: PubSubMessage) {
    throw new Error(
      "unimplemented - this should be overwritten by connections that support it",
    );
  }

  /** Remove this connection from the global connections map and clean up resources. */
  destroy() {
    return api.connections.destroy(this.type, this.identifier, this.id);
  }

  /**
   * Load the session from Redis (or create a new one if none exists).
   * No-ops if the session is already loaded. Sets `sessionLoaded` to `true`.
   */
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

function logAction(opts: {
  actionName: string | undefined;
  connectionType: string;
  status: "OK" | "ERROR";
  duration: number;
  params: Record<string, any>;
  method: string;
  url: string;
  identifier: string;
  correlationId: string | undefined;
  error: TypedError | undefined;
}) {
  if (config.logger.format === LogFormat.json) {
    const data: Record<string, any> = {
      action: opts.actionName,
      connectionType: opts.connectionType,
      status: opts.status,
      duration: opts.duration,
      params: opts.params,
    };
    if (opts.method) data.method = opts.method;
    if (opts.url) data.url = opts.url;
    if (opts.identifier) data.identifier = opts.identifier;
    if (opts.correlationId) data.correlationId = opts.correlationId;
    if (opts.error) {
      data.error = opts.error.message;
      data.errorType = opts.error.type;
      if (opts.error.stack) data.errorStack = opts.error.stack;
    }

    logger.info(`action: ${opts.actionName}`, data);
  } else {
    const loggingParams = config.logger.colorize
      ? colors.gray(JSON.stringify(opts.params))
      : JSON.stringify(opts.params);

    const statusMessage = `[ACTION:${opts.connectionType.toUpperCase()}:${opts.status}]`;
    const messagePrefix = config.logger.colorize
      ? opts.status === "OK"
        ? colors.bgBlue(statusMessage)
        : colors.bgMagenta(statusMessage)
      : statusMessage;

    const errorStack =
      opts.error && opts.error.stack
        ? config.logger.colorize
          ? "\r\n" + colors.gray(opts.error.stack)
          : "\r\n" + opts.error.stack
        : "";

    const correlationIdTag = opts.correlationId
      ? ` [cor:${opts.correlationId}]`
      : "";

    logger.info(
      `${messagePrefix} ${opts.actionName} (${opts.duration}ms) ${opts.method.length > 0 ? `[${opts.method}]` : ""} ${opts.identifier}${opts.url.length > 0 ? `(${opts.url})` : ""}${correlationIdTag} ${opts.error ? opts.error : ""} ${loggingParams} ${errorStack}`,
    );
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
