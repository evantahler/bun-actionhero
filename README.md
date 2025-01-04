# bun-actionhero

[![Test](https://github.com/evantahler/bun-actionhero/actions/workflows/test.yaml/badge.svg)](https://github.com/evantahler/bun-actiopnhero/actions/workflows/test.yaml)

Project Board: https://github.com/users/evantahler/projects/1/views/1

## What is this Project?

This project aims to be a "modern" rewrite of the "full" ActionHero stack. It is a template for a new project, and is not yet feature complete. It is a work in progress.

I still believe in many of the ideas of Actionhero, which itself was an attempt to take the "best" ideas from Rails and and Node.js and shove them together.

### The key components of this project remain:

- Transport-agnostic Actions (HTTP, WebSockets, CLI, etc)
- Built-in support for background tasks (node-resuqe)
- Built-in support for caches (redis/actionhero-cache)
- Built in, strongly-typed API support connecting the backend to the frontend
- (new) Built-in support for ORM/models/migrations (replacing the `ah-sequelize-plugin`, which adds Sequelize to the mix; optionally using SQLite locally)
- (new) Built-in support page rendering (replacing the `ah-next-plugin`, which adds Next.js to the mix)

### Why Bun?

- TS/JS is still the best language
- Bundling
- Testing
- Module Resolution
- Amazing Packager
- Great DX.

## Getting Started

To install dependencies:

```bash
bun install
brew install caddy
```

To run:

```bash
# one-time env setup
cp .env.example .env
createdb bun

# run the proxy, frontened, and backend
bun dev # this will hot-reload the server when server files change
```

To test:

```bash
# one time db setup
createdb bun-test

# run all tests
bun ci # runs linting, compilation, and all tests
# or
bun tests # runs just the tests

# run a single test file
cd backend
bun test __tests__/actions/user.test.ts

# run all all the stuff that CI does
bun test # from the root
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
bun prepare
# in .env, set NODE_ENV=production and set next.dev=false
bun start
```

## Databases and Migrations

This project uses Drizzle as the ORM. Migrations are derived from the schemas. To create a migration from changes in `scheams/*.ts` run `bun run migrations.ts`. Then, restart the server - pending migrations are auto-applied.

## Actions, CLI Commands, and Tasks

Unlike Actionhero, we've removed the distinction between Actions, CLI commands, and Tasks. They are all the same thing now! You can run any action from the CLI, and any action can be scheduled as a task. Each action gains a `type` property to define its purpose. The same input validation and responses are used for each, just like how Actions work for both web and websocket requests.

Run an action from the CLI:

```bash
# I like using -q (hide logging output) and then piping the response through jq
 ./actionhero.ts "user:create" --name evan --email "evantahler@gmail.com" --password password -q | jq

# use the --help flag to learn more
```

## Intentional changes from ActionHero

**Multiple Applications + Proxy**

- We use Caddy as a reverse proxy to serve both the frontend and backend - 2 Bun applications. This allows each app to do what it does best.

**Actions, Tasks, and CLI Commands**

- All 'controllers' are the same now! Actions are used for tasks and command line execution now, and configured for each purpose via properties. This should simplify things, and encourage reusability even more.

**Process**

- No more pifiles.

**Logger**

- simplified logger. No more winston - only STDOUT and STDERR remain

**Config**

- Config remains statically defined at boot. However, there's now per-env overwrites based on NODE_ENV (e.g. `logger.level.test` trumps `logger.level` when NDOE_ENV=test.)

**Middleware**

- TODO, but there will be some changes...

**Routes**

- Actions define their own routes as regular expression matchers (no `routes.ts`)

**CLI**

- CLI runs regular actions, not special CLI controllers.

**Testing**

- No mock server. Let's make real API requests. Now that bun has `fetch` included, it's easy.

**ORM**

- we use drizzle for the ORM and migrations.

**React and Frontend**

- We bundle next.js into the project.
