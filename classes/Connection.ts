import { api, logger } from "../api";
import { config } from "../config";
import colors from "colors";
import type { Action, ActionParams } from "./Action";
import { ErrorType, TypedError } from "./TypedError";
import type { SessionData } from "../initializers/session";

export class Connection {
  type: string;
  identifier: string;
  id: string;
  session?: SessionData;

  constructor(
    type: string,
    identifier: string,
    id = crypto.randomUUID() as string,
  ) {
    this.type = type;
    this.identifier = identifier;
    this.id = id;
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

    try {
      const action = this.findAction(actionName);
      if (!action) {
        throw new TypedError(
          `Action not found${actionName ? `: ${actionName}` : ""}`,
          ErrorType.CONNECTION_ACTION_NOT_FOUND,
        );
      }

      await this.loadSession();

      const formattedParams = await this.formatParams(params, action);
      response = await action.run(formattedParams, this);
    } catch (e) {
      loggerResponsePrefix = "ERROR";
      error =
        e instanceof TypedError
          ? e
          : new TypedError(`${e}`, ErrorType.CONNECTION_ACTION_RUN);
    }

    // Note: we want the params object to remain on the same line as the message, so we stringify
    const loggingParams = config.logger.colorize
      ? colors.gray(JSON.stringify(params))
      : JSON.stringify(params);

    const messagePrefix = config.logger.colorize
      ? loggerResponsePrefix === "OK"
        ? colors.bgBlue(`[${loggerResponsePrefix}]`)
        : colors.bgMagenta(`[${loggerResponsePrefix}]`)
      : `[${loggerResponsePrefix}]`;

    const duration = new Date().getTime() - reqStartTime;

    logger.info(
      `${messagePrefix} ${actionName} (${duration}ms) ${method.length > 0 ? `[${method}]` : ""} ${this.identifier}${url.length > 0 ? `(${url})` : ""} ${error ? error : ""} ${loggingParams}`,
    );

    return { response, error };
  }

  async updateSession(data: Record<string, any>) {
    await this.loadSession();

    if (!this.session) {
      throw new TypedError(
        "Session not found",
        ErrorType.CONNECTION_SESSION_NOT_FOUND,
      );
    }

    return api.session.update(this.session, data);
  }

  private async loadSession() {
    if (this.session) return;

    const session = await api.session.load(this);
    if (session) {
      this.session = session;
    } else {
      this.session = await api.session.create(this);
    }
  }

  private findAction(actionName: string | undefined) {
    return api.actions.actions.find((a) => a.name === actionName);
  }

  private async formatParams(params: FormData, action: Action) {
    if (!action.inputs) return {} as ActionParams<Action>;

    const formattedParams = {} as ActionParams<Action>;

    for (const [key, paramDefinition] of Object.entries(action.inputs)) {
      let value = params.get(key); // TODO: handle getAll for multiple values

      try {
        if (!value && paramDefinition.default) {
          value =
            typeof paramDefinition.default === "function"
              ? paramDefinition.default(value)
              : paramDefinition.default;
        }
      } catch (e) {
        throw new TypedError(
          `Error creating default value for for param ${key}: ${e}`,
          ErrorType.CONNECTION_ACTION_PARAM_DEFAULT,
        );
      }

      if (
        paramDefinition.required === true &&
        (value === undefined || value === null)
      ) {
        throw new TypedError(
          `Missing required param: ${key}`,
          ErrorType.CONNECTION_ACTION_PARAM_REQUIRED,
          key,
        );
      }

      if (paramDefinition.formatter && value !== undefined && value !== null) {
        try {
          value = paramDefinition.formatter(value);
        } catch (e) {
          throw new TypedError(
            `${e}`,
            ErrorType.CONNECTION_ACTION_PARAM_FORMATTING,
            key,
            value,
          );
        }
      }

      if (paramDefinition.validator && value !== undefined && value !== null) {
        const validationResponse = paramDefinition.validator(value);
        if (validationResponse !== true) {
          throw new TypedError(
            validationResponse instanceof Error
              ? validationResponse.message
              : validationResponse,
            ErrorType.CONNECTION_ACTION_PARAM_VALIDATION,
            key,
            value,
          );
        }
      }

      formattedParams[key] = value as any;
    }

    return formattedParams;
  }
}
