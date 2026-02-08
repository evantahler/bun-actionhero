---
description: Initializer class definition and the module augmentation pattern.
---

# Initializer

Source: `backend/classes/Initializer.ts`

Initializers are the lifecycle components that boot up your server. They run in priority order during `initialize → start → stop`, and each one attaches its namespace to the global `api` singleton.

## Class Definition

```ts
abstract class Initializer {
  /** The name of the initializer — also used as the api namespace key */
  name: string;

  /** Order for initialize() phase. Lower = runs first. Default: 1000 */
  loadPriority: number;

  /** Order for start() phase. Lower = runs first. Default: 1000 */
  startPriority: number;

  /** Order for stop() phase. Lower = runs first. Default: 1000 */
  stopPriority: number;

  /** Which run modes this initializer activates in */
  runModes: RUN_MODE[];

  constructor(name: string);

  /** Set up namespace object and return it. Attaches to api[name]. */
  async initialize?(): Promise<any>;

  /** Connect to external services. All initializers are loaded by this point. */
  async start?(): Promise<any>;

  /** Clean up — close connections, flush buffers. */
  async stop?(): Promise<any>;
}
```

## RUN_MODE

Initializers can be scoped to specific run modes. By default, they run in both:

```ts
enum RUN_MODE {
  CLI = "cli",
  SERVER = "server",
}
```

## Module Augmentation Pattern

This is how each initializer makes `api.myNamespace` fully typed. You declare the type on the `API` interface, and TypeScript knows what's there:

```ts
const namespace = "db";

declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<DB["initialize"]>>;
  }
}
```

The return type of `initialize()` becomes `api[namespace]` — autocomplete, type checking, the works.

## Priority Reference

Core initializers use priorities below 1000 to ensure they run before application code:

| Priority | Initializers                                         |
| -------- | ---------------------------------------------------- |
| 100      | `actions`, `db`                                      |
| 150      | `pubsub`, `swagger`                                  |
| 250      | `resque`                                             |
| 1000     | `redis`, `application`, and your custom initializers |
