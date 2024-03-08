import { logger } from "../api";
import { config } from "../config";
import colors from "colors";

export class Connection {
  type: string;
  ipAddress: string;
  id: string;

  constructor(type: string, ipAddress: string) {
    this.id = crypto.randomUUID();
    this.type = type;
    this.ipAddress = ipAddress;
  }

  async act<T>(
    actionName: string,
    params: FormData,
    method: Request["method"] = "",
    url: string = ""
  ): Promise<{ response: Object; error?: Error }> {
    const reqStartTime = new Date().getTime();
    let response: "OK" | "ERROR" = "OK";

    // TODO: run the action

    // Note: we want the params object to remain on the same line as the message, so we stringify
    const loggingParams = config.logger.colorize
      ? colors.gray(JSON.stringify(params))
      : JSON.stringify(params);

    const duration = new Date().getTime() - reqStartTime;

    logger.info(
      `[${response}] ${method.length > 0 ? `[${method}]` : ""} ${this.ipAddress} -> ${actionName} ${url.length > 0 ? `(via ${url})` : ""} (${duration}ms) ${loggingParams}`
    );

    return { response: { ok: "yay" }, error: undefined };
  }
}
