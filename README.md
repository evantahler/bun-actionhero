# bun-api-template

[![Test](https://github.com/evantahler/bun-api-template/actions/workflows/test.yaml/badge.svg)](https://github.com/evantahler/bun-api-template/actions/workflows/test.yaml)

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
```

To run:

```bash
# one-time env setup
cp .env.example .env
createdb bun

# run the app
bun run --watch index.ts # this will hot-reload the server when server files change
bun run index.ts # when working on the front-end, we can rely on next.js' hot-reloading instead of bun's
```

To test:

```bash
# one time db setup
createdb bun-test

# run the tests
bun test

# run a single test file
bun test __tests__/actions/user.test.ts

# run all all the stuff that CI does
bun ci
```

To lint:

```bash
# To test
bun run prettier --check .
# To Fix
bun run prettier --write .
```

## Production Builds

```bash
# install only prod deps
bun install --production --frozen-lockfile
# pre-compile the front-end
bun run next build
# in .env, set NODE_ENV=production and set next.dev=false
```

## Databases and Migrations

This project uses Drizzle as the ORM. Migrations are derived from the schemas. To create a migration from changes in `scheams/*.ts` run `bun run migrations.ts`. Then, restart the server - pending migrations are auto-applied.

## Intentional changes from ActionHero

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
