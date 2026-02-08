# bun-actionhero

[![Test](https://github.com/evantahler/bun-actionhero/actions/workflows/test.yaml/badge.svg)](https://github.com/evantahler/bun-actiopnhero/actions/workflows/test.yaml)

Project Board: https://github.com/users/evantahler/projects/1/views/1

## What is this Project?

This project aims to be a "modern" rewrite of the "full" ActionHero stack. It is a template for a new project, and is not yet feature complete. It is a work in progress.

I still believe in many of the ideas of Actionhero, which itself was an attempt to take the "best" ideas from Rails and and Node.js and shove them together.

### The key components of this project remain:

- Transport-agnostic Actions (HTTP, WebSockets, CLI, etc)
- Built-in support for background tasks (via [node-resque](https://github.com/actionhero/node-resque))
- Built in, strongly-typed API support connecting the backend to the frontend
- (new) Built-in support for ORM/models/migrations (replacing the `ah-sequelize-plugin`, which adds drizzleORM to the mix; optionally using SQLite locally)
- (new) Companion frontend application (replacing the `ah-next-plugin`), which adds Next.js to the mix - the frontend is a separate application, and is not bundled into the backend.

### Why Bun?

TS/JS is still the best language for any web API. However, node.js has stalled and is not moving forward. Bun is a modern, fast, and easy to use package manager that is a great fit for this project which includes:

- Bundling
- Testing
- Module Resolution
- Amazing Packager
- Great DX.

## Project Structure

- **root**: a slim package.json which wraps the backend and frontend directories. This is for convenience when developing. The regular commands `bun install`, `bun dev` work here, but you need to change to the frontend and backend dirs to run tests.
- **backend**: The actionhero server.
- **frontend**: The frontend next.js application.

## Local Development

Install Dependencies (macOS):

```bash
# install bun
curl -fsSL https://bun.sh/install | bash

# install postgres
brew install postgresql

# install redis
brew install redis

# start postgres and redis
brew services start postgresql
brew services start redis

# create a database
createdb bun
```

To install packages:

```bash
bun install
```

Set environment variables:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# update as needed
```

To run:

```bash
# run both the front-end and back-end from the root directory
bun dev
```

Both the front-end and back-end will hot-reload when files change!

To test:

```bash
# one time db setup
createdb bun-test

# run all tests
bun run ci # runs linting, compilation, and all tests

# run a single test file
cd backend
bun test __tests__/actions/user.test.ts
```

To lint:

```bash
# To test
bun lint
# To Fix
bun pretty
```

## Production Builds

```bash
# pre-compile the front-end and backend
bun compile
# in .env, set NODE_ENV=production and set next.dev=false
bun start
```

## Databases and Migrations

This project uses Drizzle as the ORM. Migrations are derived from the schemas. To create a migration from changes in `scheams/*.ts` run `bun run migrations.ts`. Then, restart the server - pending migrations are auto-applied.

## Actions, CLI Commands, and Tasks

Unlike Actionhero, we've removed the distinction between Actions, CLI commands, and Tasks. They are all the same thing now! You can run any action from the CLI, and any action can be scheduled as a task. The same input validation and responses are used for each, just like how Actions work for both web and websocket requests.

Run an action from the CLI:

```bash
# I like using -q (hide logging output) and then piping the response through jq

 ./actionhero.ts "user:create" --name evan --email "evantahler@gmail.com" --password password -q | jq

# use the --help flag to learn more
```

### Web Actions

Add a `web` property to the action to enable it to be called via HTTP:

```ts
web = { route: "/message", method: HTTP_METHOD.PUT };
```

### CLI Actions

Enabled by default

### Websocket Actions

Enabled by default

### Task Actions

Actions which have a `task` property can be scheduled as a task. A `queue` property is required, and a `frequency` property is optional to automatically schedule these tasks in a cron-like manner.

```ts
task = { queue: "default", frequency: 1000 * 60 * 60 }; // run the task every hour
```

### Fan-Out Tasks

A scheduled parent task can distribute work across many child jobs for parallel processing using `api.actions.fanOut()`. This is useful for tasks like "process all users" that need to fan out to individual worker jobs.

**Queue Priority**: Workers drain queues left-to-right. Configure `queues: ["worker", "scheduler"]` so child jobs on `"worker"` are processed before parent jobs on `"scheduler"`.

**API**:
- `api.actions.fanOut(actionName, inputsArray, queue?, options?)` — Single-action form: bulk-enqueues the same action with different inputs.
- `api.actions.fanOut(jobs[], options?)` — Multi-action form: each job specifies `{ action, inputs?, queue? }` so you can fan out to different action types in one batch.
- `api.actions.fanOutStatus(fanOutId)` — Returns `{ total, completed, failed, results, errors }`.
- Options: `batchSize` (default 100), `resultTtl` (default 600s / 10 min).

**Example — single action**:

```ts
// Parent: scheduled task that fans out work
export class ProcessAllUsers implements Action {
  name = "users:processAll";
  task = { frequency: 1000 * 60 * 60, queue: "scheduler" };
  async run() {
    const users = await getActiveUsers();
    const result = await api.actions.fanOut(
      "users:processOne",
      users.map(u => ({ userId: u.id })),
      "worker",
    );
    return { fanOut: result };
  }
}

// Child: processes one unit of work (no special fan-out code needed)
export class ProcessOneUser implements Action {
  name = "users:processOne";
  task = { queue: "worker" };
  inputs = z.object({ userId: z.string() });
  async run(params) { /* process one user */ }
}
```

**Example — multiple actions**:

```ts
// Fan out to different action types in one batch
const result = await api.actions.fanOut([
  { action: "users:processOne", inputs: { userId: "1" } },
  { action: "users:processOne", inputs: { userId: "2" } },
  { action: "emails:send", inputs: { to: "a@b.com" }, queue: "priority" },
]);
// result.actionName → ["users:processOne", "emails:send"]
// result.queue → ["worker", "priority"]

// Query results — same API for both forms
const status = await api.actions.fanOutStatus(result.fanOutId);
// → { total: 3, completed: 3, failed: 0, results: [...], errors: [...] }
```

Fan-out metadata and results are stored in Redis with a configurable TTL (default 10 minutes). The TTL is refreshed on each child job completion, so it's relative to the last activity rather than fan-out creation.

## Marking Secret Fields in Action Inputs

You can mark sensitive fields in your zod schemas as secret using the custom `.secret()` mixin. This is useful for fields like passwords, API keys, or tokens that should never be logged or exposed in logs.

**How to use:**

```ts
inputs = z.object({
  email: z.string().email(),
  password: z.string().min(8).secret(), // This field will be redacted in logs
});
```

When an action is executed, any field marked with `.secret()` will be replaced with `[[secret]]` in logs and not exposed in any logging output, even if the action fails or validation errors occur.

This works for any zod field type (string, number, etc). Simply chain `.secret()` to the field definition.

## Intentional changes from ActionHero

**Multiple Applications**

Rather than bundling in the frontend into the backend, we are running two separate Bun applications. This allows each app to do what it does best, and for you to deploy them independently. e.g. perhaps you want to host the frontend on Vercel, or statically compile it.

In development, we use `node-foreman` and `Procfile` to run both the frontend and backend at the same time.

**Actions, Tasks, and CLI Commands**

All 'controllers' are the same now! Actions are used for tasks and command line execution now, and configured for each purpose via properties. This should simplify things, and encourage reusability even more.

**Logger**

Simplified logger. No more winston - only STDOUT and STDERR remain. Basic logging levels are supported, and colors and timestamps are optional.

**Process**

No more `pidfiles`.

**Config**

Config remains statically defined at boot. However, there's now per-env overwrites based on NODE_ENV (e.g. `logger.level.test` trumps `logger.level` when `NODE_ENV=test`.)

**Middleware**

Middleware is applied to actions as an array of `ActionMiddleware` objects. Middleware is run before and after the action is run if the `.runBefore` and `.runAfter` methods are defined. Middleware can be used for authentication, authorization, logging, and more. Optionally, middleware can throw an error to halt execution of the action. Middleware can also modify the params or the response.

```ts
middleware = [SessionMiddleware];
```

**Routes**

Actions define their own routes as regular expression matchers (no `routes.ts`)

**CLI**

CLI runs regular actions, not special CLI controllers.

**Testing**

No mock server. Let's make real API requests. Now that bun has `fetch` included, it's easy!

**ORM**

We use drizzle for the ORM and migrations.

**Cache**

The actionhero cache layer has been removed. Instead, use redis directly... it's still part of the stack.

**Sessions**

Sessions are handled via cookies, and now a first-class part of the API. Session data is stored in redis.

## Production Deployment

Each application has its own Dockerfile, and a docker-compose.yml file to run them together. You probably won't use this in production directly, but it shows you an example of how to deploy the project.
