---
description: Initializers are lifecycle components that set up services and attach them to the global API singleton.
---

# Initializers

Initializers are the backbone of the server's boot process. They're lifecycle components that set up services — connecting to databases, starting Redis, registering actions, configuring the task queue — in a controlled, priority-ordered sequence.

If you've worked with the original ActionHero, initializers will feel familiar. The big difference here is the TypeScript integration: each initializer uses module augmentation to extend the `API` interface with its namespace, so `api.db`, `api.redis`, `api.actions` are all fully typed throughout the codebase.

## Lifecycle

The server goes through three phases:

```
initialize()  →  start()  →  [running]  →  stop()
```

- **`initialize()`** — set up your namespace object and return it. This is where you define the shape of what gets attached to `api`.
- **`start()`** — connect to external services (databases, Redis, etc.). By this point, all initializers have been loaded, so you can reference other namespaces.
- **`stop()`** — clean up. Close connections, flush buffers, shut down gracefully.

## Priority Ordering

Each initializer has three priority values. Lower numbers run first:

| Initializer   | Load Priority | What it does                            |
| ------------- | ------------- | --------------------------------------- |
| `actions`     | 100           | Discovers and registers all actions     |
| `db`          | 100           | Sets up Drizzle ORM + connection pool   |
| `pubsub`      | 150           | Redis PubSub for real-time messaging    |
| `swagger`     | 150           | Parses source code for OpenAPI schemas  |
| `resque`      | 250           | Background task queue                   |
| `application` | 1000          | App-specific setup (default user, etc.) |

The defaults are `1000` for all three priorities (`loadPriority`, `startPriority`, `stopPriority`), so core framework initializers use lower values to ensure they run first.

## The Module Augmentation Pattern

This is the part that makes the type system work. Each initializer extends the `API` interface so TypeScript knows what's available on the `api` singleton:

```ts
import { Initializer } from "../classes/Initializer";
import { api, logger } from "../api";

const namespace = "db";

// This is the magic — tells TypeScript that api.db exists and what type it is
declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<DB["initialize"]>>;
  }
}

export class DB extends Initializer {
  constructor() {
    super(namespace);
    this.loadPriority = 100;
    this.startPriority = 100;
    this.stopPriority = 910;
  }

  async initialize() {
    const dbContainer = {} as {
      db: ReturnType<typeof drizzle>;
      pool: Pool;
    };
    return Object.assign(
      {
        generateMigrations: this.generateMigrations,
        clearDatabase: this.clearDatabase,
      },
      dbContainer,
    );
  }

  async start() {
    api.db.pool = new Pool({
      connectionString: config.database.connectionString,
    });
    api.db.db = drizzle(api.db.pool);
    // migrations run here if configured...
  }

  async stop() {
    await api.db.pool.end();
  }
}
```

The return value of `initialize()` becomes `api.db` — and that type flows everywhere. You get autocomplete in your actions, your tests, your ops layer… everywhere.

## The `api` Singleton

The `api` object lives on `globalThis` and accumulates namespaces as initializers run:

```ts
api.db; // Drizzle ORM + Postgres pool
api.redis; // Redis client
api.actions; // Action registry + fan-out
api.session; // Session manager
api.pubsub; // Redis PubSub
api.swagger; // OpenAPI schema cache
api.resque; // Background task queue
```

Every namespace is typed via module augmentation, so you never have to cast or guess at the shape of `api.db` or `api.redis`.

## Auto-Discovery

Initializers are auto-discovered. Drop a `.ts` file in `initializers/`, export a class that extends `Initializer`, and it'll get picked up on boot. Files prefixed with `.` are skipped — useful for temporarily disabling an initializer without deleting it.
