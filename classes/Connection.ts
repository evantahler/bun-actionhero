import { api, logger } from "../api";
import { config } from "../config";
import colors from "colors";
import type { Action, ActionParams } from "./Action";

export class Connection {
  type: string;
  ipAddress: string;
  id: string;

  constructor(type: string, ipAddress: string) {
    this.id = crypto.randomUUID();
    this.type = type;
    this.ipAddress = ipAddress;
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
  ): Promise<{ response: Object; error?: Error }> {
    const reqStartTime = new Date().getTime();
    let loggerResponsePrefix: "OK" | "ERROR" = "OK";
    let response: Object = {};
    let error: Error | undefined;

    try {
      const action = this.findAction(actionName);
      if (!action) throw new Error(`Action not found: ${actionName}`);
      const formattedParams = await this.formatParams(params, action);
      response = await action.run(formattedParams, this);
    } catch (e: any) {
      loggerResponsePrefix = "ERROR";
      error = e;
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
      `${messagePrefix} ${actionName} (${duration}ms) ${method.length > 0 ? `[${method}]` : ""} ${this.ipAddress}${url.length > 0 ? `(${url})` : ""} ${error ? error : ""} ${loggingParams}`,
    );

    return { response, error };
  }

  findAction(actionName: string | undefined) {
    return api.actions.actions.find((a) => a.name === actionName);
  }

  async formatParams(params: FormData, action: Action) {
    if (!action.inputs) return {} as ActionParams<Action>;

    const formattedParams = {} as ActionParams<Action>;

    for (const [key, paramDefinition] of Object.entries(action.inputs)) {
      let value = params.get(key); // TODO: handle getAll for multiple values

      if (!value && paramDefinition.default) {
        value =
          typeof paramDefinition.default === "function"
            ? paramDefinition.default(value)
            : paramDefinition.default;
      }

      if ((paramDefinition.required && value === undefined) || value === null) {
        throw new Error(`Missing required param: ${key}`);
      }

      if (paramDefinition.formatter) {
        value = paramDefinition.formatter(value);
      }

      if (paramDefinition.validator) {
        const valid = paramDefinition.validator(value);
        if (!valid) {
          throw new Error(`Invalid value for param: ${key}: ${value}`);
        }
      }

      formattedParams[key] = value as any;
    }

    return formattedParams;
  }
}
