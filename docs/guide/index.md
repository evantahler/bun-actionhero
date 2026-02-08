---
description: Get up and running with bun-actionhero — prerequisites, installation, and your first dev server.
---

# Getting Started

bun-actionhero is a modern rewrite of [ActionHero](https://www.actionherojs.com), rebuilt from scratch on [Bun](https://bun.sh). I still believe in the core ideas behind ActionHero — transport-agnostic actions, built-in background tasks, strong typing between frontend and backend — but the original framework was showing its age. This project takes those ideas and pairs them with modern tooling: Bun for the runtime, Zod for validation, Drizzle for the ORM, and Next.js for the frontend.

The result is a full-stack monorepo template where you write your controller logic once, and it works as an HTTP endpoint, WebSocket handler, CLI command, and background task… all at the same time.

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

## Clone and Install

```bash
git clone https://github.com/evantahler/bun-actionhero.git
cd bun-actionhero
bun install
```

## Environment Variables

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# update as needed
```

## Run the Dev Server

```bash
bun dev
```

That's it. Both the frontend and backend will start with hot reload — edit a file, save it, and see the change immediately.

## Project Structure

The repo is a monorepo with two workspaces:

```
bun-actionhero/
├── backend/            # The ActionHero API server
│   ├── actions/        # Transport-agnostic controllers
│   ├── initializers/   # Lifecycle components (DB, Redis, etc.)
│   ├── config/         # Modular configuration
│   ├── classes/        # Core framework classes
│   ├── middleware/      # Action middleware (auth, etc.)
│   ├── ops/            # Business logic layer
│   ├── schema/         # Drizzle ORM table definitions
│   ├── servers/        # HTTP + WebSocket server
│   └── channels/       # PubSub channel definitions
├── frontend/           # Next.js application
└── docs/               # This documentation site
```

The `backend/` and `frontend/` are separate Bun applications. This is an intentional change from the original ActionHero — rather than bundling the frontend into the backend, each app does what it does best. You could host the frontend on Vercel and the backend on a VPS if you wanted to.

## What's Next

- [Actions](/guide/actions) — the core concept. Everything is an action.
- [Initializers](/guide/initializers) — how the server boots up and connects to services
- [Tasks](/guide/tasks) — background jobs and the fan-out pattern
- [Configuration](/guide/config) — environment-based config with per-env overrides
