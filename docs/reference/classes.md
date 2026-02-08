---
description: API singleton, Connection, Channel, Server, TypedError, and Logger class definitions.
---

# Other Classes

The remaining framework classes — the API singleton, connections, channels, servers, errors, and logging.

## API

Source: `backend/classes/API.ts`

The global singleton that manages the full server lifecycle. Stored on `globalThis` so it's accessible everywhere. Initializers attach their namespaces to it during boot.

```ts
class API {
  rootDir: string;
  initialized: boolean;
  started: boolean;
  stopped: boolean;
  bootTime: number;
  logger: Logger;
  runMode: RUN_MODE;
  initializers: Initializer[];

  /** Run all initializers in loadPriority order */
  async initialize(): Promise<void>;

  /** Start all initializers in startPriority order */
  async start(runMode?: RUN_MODE): Promise<void>;

  /** Stop all initializers in stopPriority order */
  async stop(): Promise<void>;

  /** Stop then start */
  async restart(): Promise<void>;

  // Initializer namespaces are added dynamically:
  // api.db, api.redis, api.actions, api.session, etc.
  [key: string]: any;
}
```

The lifecycle is `initialize() → start() → [running] → stop()`. Calling `start()` automatically calls `initialize()` first if it hasn't been called yet.

## Connection

Source: `backend/classes/Connection.ts`

Represents a client connection — HTTP request, WebSocket, or CLI invocation. The connection handles action execution, session management, and channel subscriptions.

```ts
class Connection<T extends Record<string, any> = Record<string, any>> {
  /** Connection type: "web", "websocket", "cli" */
  type: string;

  /** Client identifier (IP, socket ID, etc.) */
  identifier: string;

  /** Unique connection ID (UUID) */
  id: string;

  /** Session data, typed with your session shape */
  session?: SessionData<T>;

  /** Channels this connection is subscribed to */
  subscriptions: Set<string>;

  /** The underlying transport object (Bun Request, WebSocket, etc.) */
  rawConnection?: any;

  /** Execute an action with the given params */
  async act(
    actionName: string | undefined,
    params: FormData,
    method?: string,
    url?: string,
  ): Promise<{ response: Object; error?: TypedError }>;

  /** Update session data (merges with existing) */
  async updateSession(data: Partial<T>): Promise<void>;

  /** Subscribe to a PubSub channel */
  subscribe(channel: string): void;

  /** Unsubscribe from a PubSub channel */
  unsubscribe(channel: string): void;

  /** Broadcast a message to a subscribed channel */
  async broadcast(channel: string, message: string): Promise<void>;

  /** Remove this connection from the connection pool */
  destroy(): void;
}
```

The generic `T` parameter types your session data. For example, `Connection<{ userId: number }>` gives you typed access to `connection.session.data.userId`.

## Channel

Source: `backend/classes/Channel.ts`

Defines a PubSub topic for WebSocket real-time messaging. Channels support exact-match names or RegExp patterns.

```ts
abstract class Channel {
  /** String for exact match, RegExp for pattern matching */
  name: string | RegExp;

  description?: string;

  /** Middleware for subscribe/unsubscribe lifecycle */
  middleware: ChannelMiddleware[];

  /** Check if this channel definition matches a requested channel name */
  matches(channelName: string): boolean;

  /** Override for custom authorization logic. Throw TypedError to deny. */
  async authorize(channelName: string, connection: Connection): Promise<void>;
}
```

### ChannelMiddleware

```ts
type ChannelMiddleware = {
  /** Runs before subscribe — throw TypedError to deny */
  runBefore?: (channel: string, connection: Connection) => Promise<void>;

  /** Runs after unsubscribe — cleanup, presence tracking, etc. */
  runAfter?: (channel: string, connection: Connection) => Promise<void>;
};
```

## Server

Source: `backend/classes/Server.ts`

Base class for transport servers. The framework ships with a web server (`Bun.serve` for HTTP + WebSocket), but you could add others.

```ts
abstract class Server<T> {
  name: string;

  /** The underlying server object (e.g., Bun.Server) */
  server?: T;

  abstract initialize(): Promise<void>;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
}
```

## TypedError

Source: `backend/classes/TypedError.ts`

All action errors should use `TypedError` instead of generic `Error`. Each error type maps to an HTTP status code, so the framework knows what status to return to the client.

```ts
class TypedError extends Error {
  type: ErrorType;
  key?: string; // which param caused the error
  value?: any; // what value was invalid

  constructor(args: {
    message: string;
    type: ErrorType;
    originalError?: unknown;
    key?: string;
    value?: any;
  });
}
```

### ErrorType → HTTP Status Mapping

| ErrorType                            | Status | When                                       |
| ------------------------------------ | ------ | ------------------------------------------ |
| `SERVER_INITIALIZATION`              | 500    | Initializer failed to boot                 |
| `SERVER_START`                       | 500    | Initializer failed to start                |
| `SERVER_STOP`                        | 500    | Initializer failed to stop                 |
| `CONFIG_ERROR`                       | 500    | Invalid configuration                      |
| `ACTION_VALIDATION`                  | 500    | Action class definition is invalid         |
| `CONNECTION_SESSION_NOT_FOUND`       | 401    | No session / not authenticated             |
| `CONNECTION_ACTION_NOT_FOUND`        | 404    | Unknown action name                        |
| `CONNECTION_ACTION_PARAM_REQUIRED`   | 406    | Missing required input                     |
| `CONNECTION_ACTION_PARAM_VALIDATION` | 406    | Input failed Zod validation                |
| `CONNECTION_ACTION_RUN`              | 500    | Action threw during `run()`                |
| `CONNECTION_NOT_SUBSCRIBED`          | 406    | Tried to broadcast to unsubscribed channel |
| `CONNECTION_CHANNEL_AUTHORIZATION`   | 403    | Channel subscription denied                |

## Logger

Source: `backend/classes/Logger.ts`

Simple logger that writes to stdout. No Winston, no Pino — just STDOUT and STDERR with optional colors and timestamps.

```ts
class Logger {
  level: LogLevel;
  colorize: boolean;
  includeTimestamps: boolean;

  trace(message: string, object?: any): void;
  debug(message: string, object?: any): void;
  info(message: string, object?: any): void;
  warn(message: string, object?: any): void;
  error(message: string, object?: any): void;
  fatal(message: string, object?: any): void;
}

enum LogLevel {
  trace = "trace",
  debug = "debug",
  info = "info",
  warn = "warn",
  error = "error",
  fatal = "fatal",
}
```
