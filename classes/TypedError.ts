export const typedErrorTypes = [
  // general
  "SERVER_INITIALIZATION",
  "SERVER_START",
  "SERVER_STOP",

  // init
  "CONFIG_ERROR",
  "INITIALIZER_VALIDATION",
  "ACTION_VALIDATION",
  "TASK_VALIDATION",
  "SERVER_VALIDATION",

  // actions
  "CONNECTION_SERVER_ERROR",
  "CONNECTION_ACTION_NOT_FOUND",
  "CONNECTION_ACTION_PARAM_REQUIRED",
  "CONNECTION_ACTION_PARAM_DEFAULT",
  "CONNECTION_ACTION_PARAM_VALIDATION",
  "CONNECTION_ACTION_PARAM_FORMATTING",
  "CONNECTION_ACTION_RUN",
] as const;
export type TypedErrorType = (typeof typedErrorTypes)[number];

export class TypedError extends Error {
  type: TypedErrorType;
  key?: string;
  value?: any;

  constructor(
    message: string,
    type: TypedErrorType,
    key?: string,
    value?: any,
  ) {
    super(message);
    this.type = type;
    this.key = key;
    this.value = value;
  }
}
