/**
 * Abstract base class for transport servers (e.g., HTTP, WebSocket).
 * The generic `T` is the type of the underlying server object (e.g., `Bun.Server`).
 * Subclasses must implement `initialize()`, `start()`, and `stop()`.
 */
export abstract class Server<T> {
  name: string;

  /** The underlying server instance created by the subclass (e.g., `Bun.Server`). */
  server?: T;

  constructor(name: string) {
    this.name = name;
  }

  /** Set up routes, handlers, and configuration. Called during the framework's initialize phase. */
  abstract initialize(): Promise<void>;

  /** Bind to a port and begin accepting connections. Called during the framework's start phase. */
  abstract start(): Promise<void>;

  /** Close the server and release its port. Called during the framework's stop phase. */
  abstract stop(): Promise<void>;
}
