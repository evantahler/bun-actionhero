export enum ErrorType {
  // general
  "SERVER_INITIALIZATION" = "SERVER_INITIALIZATION",
  "SERVER_START" = "SERVER_START",
  "SERVER_STOP" = "SERVER_STOP",

  // init
  "CONFIG_ERROR" = "CONFIG_ERROR",
  "INITIALIZER_VALIDATION" = "INITIALIZER_VALIDATION",
  "ACTION_VALIDATION" = "ACTION_VALIDATION",
  "TASK_VALIDATION" = "TASK_VALIDATION",
  "SERVER_VALIDATION" = "SERVER_VALIDATION",

  // session
  "CONNECTION_SESSION_NOT_FOUND" = "CONNECTION_SESSION_NOT_FOUND",

  // actions
  "CONNECTION_SERVER_ERROR" = "CONNECTION_SERVER_ERROR",
  "CONNECTION_ACTION_NOT_FOUND" = "CONNECTION_ACTION_NOT_FOUND",
  "CONNECTION_ACTION_PARAM_REQUIRED" = "CONNECTION_ACTION_PARAM_REQUIRED",
  "CONNECTION_ACTION_PARAM_DEFAULT" = "CONNECTION_ACTION_PARAM_DEFAULT",
  "CONNECTION_ACTION_PARAM_VALIDATION" = "CONNECTION_ACTION_PARAM_VALIDATION",
  "CONNECTION_ACTION_PARAM_FORMATTING" = "CONNECTION_ACTION_PARAM_FORMATTING",
  "CONNECTION_ACTION_RUN" = "CONNECTION_ACTION_RUN",
  "CONNECTION_TYPE_NOT_FOUND" = "CONNECTION_TYPE_NOT_FOUND",
  "CONNECTION_NOT_SUBSCRIBED" = "CONNECTION_NOT_SUBSCRIBED",

  "CONNECTION_TASK_DEFINITION" = "CONNECTION_TASK_DEFINITION",
}

export const ErrorStatusCodes: Record<ErrorType, number> = {
  [ErrorType.SERVER_INITIALIZATION]: 500,
  [ErrorType.SERVER_START]: 500,
  [ErrorType.SERVER_STOP]: 500,

  [ErrorType.CONFIG_ERROR]: 500,

  [ErrorType.INITIALIZER_VALIDATION]: 500,
  [ErrorType.ACTION_VALIDATION]: 500,
  [ErrorType.TASK_VALIDATION]: 500,
  [ErrorType.SERVER_VALIDATION]: 500,

  [ErrorType.CONNECTION_SESSION_NOT_FOUND]: 401,
  [ErrorType.CONNECTION_SERVER_ERROR]: 500,
  [ErrorType.CONNECTION_ACTION_NOT_FOUND]: 404,
  [ErrorType.CONNECTION_ACTION_PARAM_REQUIRED]: 406,
  [ErrorType.CONNECTION_ACTION_PARAM_DEFAULT]: 406,
  [ErrorType.CONNECTION_ACTION_PARAM_VALIDATION]: 406,
  [ErrorType.CONNECTION_ACTION_PARAM_FORMATTING]: 406,
  [ErrorType.CONNECTION_ACTION_RUN]: 500,
  [ErrorType.CONNECTION_TYPE_NOT_FOUND]: 406,
  [ErrorType.CONNECTION_NOT_SUBSCRIBED]: 406,

  [ErrorType.CONNECTION_TASK_DEFINITION]: 500,
};

export type TypedErrorArgs = {
  message: string;
  type: ErrorType;
  originalError?: unknown;
  key?: string;
  value?: any;
};

export class TypedError extends Error {
  type: ErrorType;
  key?: string;
  value?: any;

  constructor(args: TypedErrorArgs) {
    super(args.message);
    this.type = args.type;
    this.key = args.key;
    this.value = args.value;

    if (args.originalError !== undefined) {
      if (args.originalError instanceof Error) {
        this.stack = args.originalError.stack;
      } else {
        this.stack = `OriginalStringError: ${args.originalError}`;
      }
    }
  }
}
