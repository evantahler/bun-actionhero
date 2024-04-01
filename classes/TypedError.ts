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
}

export class TypedError extends Error {
  type: ErrorType;
  key?: string;
  value?: any;

  constructor(message: string, type: ErrorType, key?: string, value?: any) {
    super(message);
    this.type = type;
    this.key = key;
    this.value = value;
  }
}
