---
description: Background tasks with Resque workers and the fan-out pattern for distributing work across child jobs.
---

# Background Tasks

One of the things I've always loved about ActionHero is that background tasks are a first-class citizen — not a plugin, not a separate service, just part of the framework. bun-actionhero keeps that tradition, using [node-resque](https://github.com/actionhero/node-resque) for job processing backed by Redis.

The key difference from the original ActionHero: tasks and actions are the same thing now. Any action can be scheduled as a background job by adding a `task` property. Same inputs, same validation, same `run()` method.

## Defining a Task

```ts
export class MessagesCleanup implements Action {
  name = "messages:cleanup";
  description = "Cleanup messages older than 24 hours";
  task = { queue: "default", frequency: 1000 * 60 * 60 }; // every hour
  inputs = z.object({
    age: z.coerce
      .number()
      .int()
      .min(1000)
      .default(1000 * 60 * 60 * 24),
  });

  async run(params: ActionParams<MessagesCleanup>) {
    const deleted = await api.db.db
      .delete(messages)
      .where(lt(messages.createdAt, new Date(Date.now() - params.age)))
      .returning();
    return { messagesDeleted: deleted.length };
  }
}
```

- **`queue`** — which Resque queue to put this job on (required)
- **`frequency`** — how often to run it, in milliseconds (optional — omit for one-shot tasks)

You can also run this same action from the CLI (`./actionhero.ts "messages:cleanup" --age 3600000 -q`) or hit it via HTTP if you add a `web` property. It's all the same code.

## Queue Priority

Workers drain queues left-to-right. This matters when you want some jobs to take priority:

```ts
// In config/tasks.ts
queues: ["worker", "scheduler"];
// Jobs on "worker" are processed before "scheduler"
```

Use `["*"]` to process all queues with equal priority. That said, for fan-out patterns (see below), you'll probably want to separate parent tasks from child tasks so the children get processed first.

## Fan-Out Pattern

This is one of my favorite features. A parent task can distribute work across many child jobs for parallel processing using `api.actions.fanOut()`. Think "process all users" where you fan out to individual "process one user" jobs.

### Single Action Fan-Out

The simple case — bulk-enqueue the same action with different inputs:

```ts
export class ProcessAllUsers implements Action {
  name = "users:processAll";
  task = { frequency: 1000 * 60 * 60, queue: "scheduler" };

  async run() {
    const users = await getActiveUsers();
    const result = await api.actions.fanOut(
      "users:processOne",
      users.map((u) => ({ userId: u.id })),
      "worker",
    );
    return { fanOut: result };
  }
}

// The child action — nothing special needed here
export class ProcessOneUser implements Action {
  name = "users:processOne";
  task = { queue: "worker" };
  inputs = z.object({ userId: z.string() });
  async run(params) {
    /* process one user */
  }
}
```

The child action doesn't know or care that it was spawned by a fan-out. It's just a regular action.

### Multi-Action Fan-Out

You can also fan out to different action types in one batch:

```ts
const result = await api.actions.fanOut([
  { action: "users:processOne", inputs: { userId: "1" } },
  { action: "users:processOne", inputs: { userId: "2" } },
  { action: "emails:send", inputs: { to: "a@b.com" }, queue: "priority" },
]);
```

### Checking Results

```ts
const status = await api.actions.fanOutStatus(result.fanOutId);
// → { total: 3, completed: 3, failed: 0, results: [...], errors: [...] }
```

Results and metadata are stored in Redis with a configurable TTL (default 10 minutes). The TTL refreshes on each child job completion, so it's relative to the last activity — not the fan-out creation time.

### Options

- **`batchSize`** — how many jobs to enqueue per batch (default: 100)
- **`resultTtl`** — how long to keep results in Redis, in seconds (default: 600)
