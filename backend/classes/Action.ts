import { z } from "zod";
import type { Connection } from "./Connection";
import type { TypedError } from "./TypedError";

export enum HTTP_METHOD {
  "GET" = "GET",
  "POST" = "POST",
  "PUT" = "PUT",
  "DELETE" = "DELETE",
  "PATCH" = "PATCH",
  "OPTIONS" = "OPTIONS",
}

export const DEFAULT_QUEUE = "default";

export type OAuthActionResponse = {
  user: { id: number };
};

export type McpActionConfig = {
  /** Expose this action as an MCP tool (default true) */
  enabled?: boolean;
  /** Tag as the OAuth login action */
  isLoginAction?: boolean;
  /** Tag as the OAuth signup action */
  isSignupAction?: boolean;
};

export type ActionConstructorInputs = {
  /** Unique action name (also used for default routes, etc.) */
  name: string;

  /** Human-friendly description (defaults to `An Action: ${name}`) */
  description?: string;

  /** Zod schema used to validate/coerce inputs (and for type inference) */
  inputs?: z.ZodType<any>;

  /** Middleware hooks to run before/after `run()` */
  middleware?: ActionMiddleware[];

  /** Expose this action via the MCP server (defaults to `{ enabled: true }`) */
  mcp?: McpActionConfig;

  /** Expose this action via HTTP (defaults: route `/${name}`, method `GET`) */
  web?: {
    /** HTTP route pattern (string with `:params` or a `RegExp`) */
    route?: RegExp | string;
    /** HTTP method to bind the route to */
    method?: HTTP_METHOD;
  };

  /** Configure this action as a background task/job */
  task?: {
    /** Optional recurring frequency in milliseconds */
    frequency?: number;
    /** Queue name to enqueue jobs onto (defaults to `"default"`) */
    queue: string;
  };

  /** Set to false to disable rate limiting for this action (default: true) */
  rateLimit?: boolean;
};

export type ActionMiddlewareResponse = {
  updatedParams?: ActionParams<Action>;
  updatedResponse?: any;
};

export type ActionMiddleware = {
  runBefore?: (
    params: ActionParams<Action>,
    connection: Connection,
  ) => Promise<ActionMiddlewareResponse | void>;
  runAfter?: (
    params: ActionParams<Action>,
    connection: Connection,
  ) => Promise<ActionMiddlewareResponse | void>;
};

export abstract class Action {
  name: string;
  description?: string;
  inputs?: z.ZodType<any>;
  middleware?: ActionMiddleware[];
  mcp?: McpActionConfig;
  web?: {
    route: RegExp | string;
    method: HTTP_METHOD;
  };
  task?: {
    frequency?: number;
    queue: string;
  };
  rateLimit?: boolean;

  constructor(args: ActionConstructorInputs) {
    this.name = args.name;
    this.description = args.description ?? `An Action: ${this.name}`;
    this.inputs = args.inputs;
    this.middleware = args.middleware ?? [];
    this.mcp = { enabled: true, ...args.mcp };
    this.web = {
      route: args.web?.route ?? `/${this.name}`,
      method: args.web?.method ?? HTTP_METHOD.GET,
    };
    this.task = {
      frequency: args.task?.frequency,
      queue: args.task?.queue ?? DEFAULT_QUEUE,
    };
    this.rateLimit = args.rateLimit;
  }

  /**
   * The main "do something" method for this action.
   * It can be `async`.
   * Usually the goal of this run method is to return the data that you want to be sent to API consumers.
   * If error is thrown in this method, it will be logged, caught, and returned to the client as `error`
   * @throws {TypedError} All errors thrown should be TypedError instances
   */
  abstract run(
    params: ActionParams<Action>,
    connection?: Connection,
  ): Promise<any>;
}

export type ActionParams<A extends Action> =
  A["inputs"] extends z.ZodType<any>
    ? z.infer<A["inputs"]>
    : Record<string, unknown>;

export type ActionResponse<A extends Action> = Awaited<ReturnType<A["run"]>> &
  Partial<{ error?: TypedError }>;
