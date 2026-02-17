---
description: Get up and running with Keryx — prerequisites, installation, and your first dev server.
---

# Getting Started

Keryx is a modern rewrite of [ActionHero](https://www.actionherojs.com), rebuilt from scratch on [Bun](https://bun.sh). I still believe in the core ideas behind ActionHero — transport-agnostic actions, built-in background tasks, strong typing between frontend and backend — but the original framework was showing its age. This project takes those ideas and pairs them with modern tooling: Bun for the runtime, Zod for validation, Drizzle for the ORM, and Next.js for the frontend.

The result is a full-stack monorepo template where you write your controller logic once, and it works as an HTTP endpoint, WebSocket handler, CLI command, and background task… all at the same time.

The name **Keryx** (κῆρυξ) comes from ancient Greek, meaning "herald" or "messenger" — the person who carried proclamations between gods and mortals. It fits: your actions are the message, and Keryx delivers them across every transport.

## Prerequisites

You'll need these running locally:

- [Bun](https://bun.sh) (latest)
- [PostgreSQL](https://www.postgresql.org/)
- [Redis](https://redis.io/)

## Installation (macOS)

```bash
# install bun
curl -fsSL https://bun.sh/install | bash

# install postgres and redis
brew install postgresql redis
brew services start postgresql
brew services start redis

# create a database
createdb bun
```

## Create a New Project

```bash
bunx keryx new my-app
cd my-app
cp .env.example .env
bun install
```

The `keryx new` command will prompt you for a project name and optional features (database setup, example action). You can also skip prompts with `--no-interactive`:

```bash
bunx keryx new my-app --no-interactive
```

## Run the Dev Server

```bash
bun dev
```

That's it. The backend will start with hot reload — edit a file, save it, and see the change immediately.

## Project Structure

A new Keryx project looks like this:

```
my-app/
├── actions/        # Transport-agnostic controllers
├── channels/       # WebSocket PubSub channels
├── drizzle/        # Generated migration SQL
├── initializers/   # Lifecycle components (DB, Redis, etc.)
├── middleware/     # Action and channel middleware
├── schema/         # Drizzle ORM table definitions
├── index.ts        # Sets api.rootDir, re-exports framework types
├── keryx.ts        # CLI entry point
├── .env.example    # Environment variable template
└── package.json
```

Actions, initializers, and channels are auto-discovered from their directories — just drop in a `.ts` file and the framework picks it up.

## What's Next

- [Actions](/guide/actions) — the core concept. Everything is an action.
- [Initializers](/guide/initializers) — how the server boots up and connects to services
- [Tasks](/guide/tasks) — background jobs and the fan-out pattern
- [Configuration](/guide/config) — environment-based config with per-env overrides
