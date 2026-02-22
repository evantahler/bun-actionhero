# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A modern TypeScript framework built on Bun, spiritual successor to ActionHero. Monorepo with three workspaces: `packages/keryx/` (publishable framework), `example/backend/` (example API server), and `example/frontend/` (Next.js app). The core idea: **Actions are the universal controller** - they serve as HTTP endpoints, WebSocket handlers, CLI commands, background tasks, and MCP tools simultaneously.

## Monorepo Structure

```
kingston/
  packages/keryx/          # Framework package (publishable as "keryx")
    classes/               # API, Action, Channel, Connection, Initializer, etc.
    initializers/          # Framework initializers (db, redis, actions, servers, etc.)
    servers/               # WebServer (Bun.serve)
    actions/               # Built-in actions (status, swagger)
    config/                # Modular config with env overrides
    middleware/             # Generic middleware (rateLimit)
    util/                  # Helpers (glob, cli, config, zodMixins, oauth)
    templates/             # OAuth HTML + SVG
    lua/                   # Redis Lua scripts
    api.ts                 # Singleton + exports
    index.ts               # Package entry point (re-exports)
    keryx.ts               # CLI entry
    __tests__/             # Framework-level tests
  example/
    backend/               # Example app using keryx
      actions/             # App actions (user, session, message, channel, files)
      initializers/        # App initializer (application.ts)
      ops/                 # Business logic (UserOps, MessageOps)
      schema/              # Drizzle ORM table definitions
      channels/            # WebSocket channels
      middleware/           # App middleware (session, channel auth)
      drizzle/             # Migration SQL files
      util/                # App-specific zodMixins
      index.ts             # Sets api.rootDir, re-exports from "keryx"
      keryx.ts             # App CLI entry
      __tests__/           # App-specific tests
    frontend/              # Next.js frontend
  docs/                    # VitePress documentation site
```

## Environment Setup

Example backend requires an `.env` file. In a fresh clone or new git worktree:

```bash
cp example/backend/.env.example example/backend/.env
```

The defaults assume a local macOS PostgreSQL where your shell `$USER` is a superuser with no password (typical for Homebrew Postgres). If that matches your setup, no edits are needed.

Similarly for frontend:

```bash
cp example/frontend/.env.example example/frontend/.env
```

**Note**: `.conductor/setup.ts` reads from `.env.example` and only overrides workspace-specific variables (ports, database names, Redis DBs). New environment variables added to `.env.example` will automatically flow through to Conductor workspaces.

## Common Commands

All commands from root unless noted. Backend tests require PostgreSQL (`keryx` and `keryx-test` databases) and Redis running locally.

```bash
bun install                        # Install all dependencies (all workspaces)
bun dev                            # Run both backend and frontend with hot reload
bun run ci                         # Full CI: lint + test all workspaces

# Package tests (run from packages/keryx/)
cd packages/keryx
bun test                           # Run framework tests

# Example backend (run from example/backend/)
cd example/backend
bun test                           # Run all example tests (uses bun:test, non-concurrent)
bun test __tests__/actions/user.test.ts  # Run a single test file
bun run dev                        # Backend only with --watch
bun run start                      # Start server
bun run migrations                 # Generate DB migrations from schema changes

# Formatting (from root)
bun lint                           # Check formatting (prettier)
bun format                         # Fix formatting (prettier)
```

## Architecture

### Dual-Directory Loading

The framework uses `packageDir` (auto-resolved from `import.meta.path`) and `rootDir` (set by the user app). Initializers, actions, and servers are loaded from both directories:

```typescript
import { api } from "keryx";
api.rootDir = import.meta.dir;  // User sets this before api.initialize()
```

### Global Singleton: `api`
The `api` object (`packages/keryx/api.ts`) is a global singleton stored on `globalThis`. It manages the full lifecycle: initialize -> start -> stop. All initializers attach their namespaces to it (e.g., `api.db`, `api.actions`, `api.redis`).

### Actions (`packages/keryx/classes/Action.ts`)
Transport-agnostic controllers. Every action defines:
- `inputs`: Zod schema for validation and type inference
- `web`: `{ route, method }` for HTTP routing (routes are regex or string with `:param` path params, defined on the action itself)
- `task`: `{ queue, frequency }` for background job scheduling
- `middleware`: Array of `ActionMiddleware` (e.g., `SessionMiddleware` for auth)
- `run(params, connection)`: The handler. **Must throw `TypedError`** for errors.
- `mcp`: `McpActionConfig` — `{ enabled, isLoginAction, isSignupAction }` (default `{ enabled: true }`)

Type helpers: `ActionParams<A>` infers input types, `ActionResponse<A>` infers return types.

Framework actions live in `packages/keryx/actions/` (status, swagger). App actions live in `example/backend/actions/` and must be re-exported from `example/backend/actions/.index.ts` for frontend type sharing.

### Initializers (`packages/keryx/classes/Initializer.ts`)
Lifecycle components with priority-based ordering. Each initializer:
1. Uses **module augmentation** to extend the `API` interface with its namespace
2. Returns its namespace object from `initialize()`
3. Connects to services in `start()`, cleans up in `stop()`

Framework initializers use relative module augmentation:
```typescript
declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<MyInitializer["initialize"]>>;
  }
}
```

User/app initializers use package module augmentation:
```typescript
declare module "keryx" {
  export interface API {
    [namespace]: Awaited<ReturnType<MyInitializer["initialize"]>>;
  }
}
```

Key initializers and their priorities: `actions` (100), `db` (100), `redis` (default), `pubsub` (150), `swagger` (150), `oauth` (175), `mcp` (200/560/90), `resque` (250), `application` (1000).

### Fan-Out Tasks (`packages/keryx/initializers/actionts.ts`)
A parent action can distribute work across many child jobs using `api.actions.fanOut()`. Child results are automatically collected in Redis via `_fanOutId` injection.

```typescript
// Single action: fan out same action with different inputs
const result = await api.actions.fanOut("child:action", inputsArray, "worker", { batchSize: 100, resultTtl: 600 });

// Multi action: fan out different actions in one batch
const result = await api.actions.fanOut([
  { action: "users:process", inputs: { userId: "1" } },
  { action: "emails:send", inputs: { to: "a@b.com" }, queue: "priority" },
], { resultTtl: 600 });

// Query results
const status = await api.actions.fanOutStatus(result.fanOutId);
// → { total, completed, failed, results: [...], errors: [...] }
```

Redis keys: `fanout:{id}` (hash), `fanout:{id}:results` (list), `fanout:{id}:errors` (list). All keys have TTL (default 10 min, refreshed on each child completion).

### Channels (`packages/keryx/classes/Channel.ts`)
PubSub channels for WebSocket real-time messaging. Channels define a `name` (string or RegExp pattern) and optional `middleware` (ChannelMiddleware) for authorization on subscribe and cleanup on unsubscribe.

### Servers (`packages/keryx/servers/web.ts`)
WebServer uses `Bun.serve` for HTTP + WebSocket. Handles routing, static files, cookies, and session management.

### MCP Server & OAuth (`packages/keryx/initializers/mcp.ts`, `packages/keryx/initializers/oauth.ts`)
MCP (Model Context Protocol) server that exposes actions as tools for AI agents. Enabled via `MCP_SERVER_ENABLED=true`.

- **Tool registration**: All actions with `mcp.enabled !== false` are registered. Names convert `:` → `-`. Zod schemas are sanitized for `zod/v4-mini` compatibility before JSON Schema conversion.
- **OAuth 2.1 endpoints**: `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`, `/oauth/register`, `/oauth/authorize` (GET/POST), `/oauth/token`
- **Login/signup markers**: Actions tagged with `mcp.isLoginAction` or `mcp.isSignupAction` are invoked during the OAuth authorization flow. Must return `OAuthActionResponse` (`{ user: { id: number } }`).
- **Redis keys**: `oauth:client:{id}` (TTL 30d), `oauth:code:{code}` (TTL 5m), `oauth:token:{token}` (TTL = session TTL)
- **Templates**: HTML pages for OAuth login/signup flow live in `packages/keryx/templates/`
- **Per-session McpServer**: Each authenticated session creates its own `McpServer` instance, tracked via `mcp-session-id` header.

### Config (`packages/keryx/config/`)
Modular config with per-environment overrides via `loadFromEnvIfSet()` — checks `ENV_VAR_NODEENV` first, then `ENV_VAR`, then falls back to the default value. Type-aware (auto-parses booleans and numbers).

### Ops (`example/backend/ops/`)
Business logic layer (e.g., `UserOps`, `MessageOps`) separating DB operations from actions.

### Schemas (`example/backend/schema/`)
Drizzle ORM table definitions. Migrations auto-apply on server start when `config.database.autoMigrate` is true.

### Zod Helpers
- **Framework** (`packages/keryx/util/zodMixins.ts`): `secret(schema)`, `isSecret()`, `zBooleanFromString()`, `zIdOrModel()` (generic factory)
- **App** (`example/backend/util/zodMixins.ts`): `zUserIdOrModel()`, `zMessageIdOrModel()` — imports `zIdOrModel` from `"keryx"`

### TypedError (`packages/keryx/classes/TypedError.ts`)
All action errors must use `TypedError` with an `ErrorType` enum. Each error type maps to an HTTP status code via `ErrorStatusCodes`.

## Imports

### In `packages/keryx/` (framework code)
Use relative imports:
```typescript
import { api } from "../api";
import { Action } from "../classes/Action";
```

### In `example/backend/` (app code)
Use `"keryx"` for framework imports, relative for app-local:
```typescript
import { api, Action, type ActionParams } from "keryx";
import { HTTP_METHOD } from "keryx/classes/Action.ts";
import { SessionMiddleware } from "../middleware/session";
```

**Important**: Bun subpath imports (e.g., `keryx/classes/Action.ts`) require the `.ts` extension.

## Coding Conventions

- **No `as any`** — Never use `as any` type assertions. Use `@ts-expect-error` with an explanatory comment when the type system can't express something, or add a proper type/interface.
- **Always `bunx`, never `npx`** — This is a Bun project. Use `bunx` for all package runner commands.
- **JSDoc annotations on public APIs** — All public classes, methods, and types in `packages/keryx/` must have JSDoc annotations. Use `@param` for every parameter (with detailed prose explaining edge cases), `@returns` when non-obvious, and `@throws {TypedError}` where applicable. See `Action.run()` in `packages/keryx/classes/Action.ts` as the reference pattern. Keep simpler methods concise — don't over-document the obvious.

## Testing Patterns

Tests use Bun's built-in test runner. Each test file boots/stops the full server:

```typescript
// Example backend test
import "../index";  // Sets api.rootDir
import { api } from "keryx";
import { HOOK_TIMEOUT, serverUrl } from "./../setup";

beforeAll(async () => { await api.start(); }, HOOK_TIMEOUT);
afterAll(async () => { await api.stop(); }, HOOK_TIMEOUT);

test("...", async () => {
  const res = await fetch(serverUrl() + "/api/status");
  const body = (await res.json()) as ActionResponse<Status>;
});
```

Tests make real HTTP requests via `fetch` - no mock server. Tests run non-concurrently to avoid port conflicts.

**Every code change should include tests.** When adding features, fixing bugs, or modifying behavior, always write or update tests to cover the change. If a PR has no test changes, that's a red flag.

### Auto-discovery
Actions, initializers, and servers are auto-discovered via `globLoader` (`packages/keryx/util/glob.ts`), which scans directories for `*.ts` files and instantiates all exported classes. Files prefixed with `.` are skipped. The framework loads from both `packageDir` and `rootDir`.

## Documentation Site (`docs/`)

VitePress site deployed to `keryxjs.com` via GitHub Pages. Key commands:

```bash
bun docs:dev                       # Preview docs locally
bun docs:build                     # Generate reference data + build static site
cd docs && bun run generate        # Regenerate reference JSON from backend source
```

**Important**: When modifying backend code (actions, initializers, config, classes), consider updating the corresponding documentation in `docs/guide/` or `docs/reference/`. The reference pages (`docs/reference/actions.md`, `initializers.md`, `config.md`) are auto-generated from source via `docs/scripts/generate-docs-data.ts`, but the guide pages (`docs/guide/*.md`) are hand-written and need manual updates.

The landing page includes `README.md` via VitePress markdown includes (`<!--@include: ../README.md-->`), so README changes automatically appear on the site.

## Pull Requests

- **Never enable auto-merge** — Do not use `gh pr merge --auto` or enable auto-merge on PRs. PRs should always be merged manually after review.

## Gotcha: Stale Processes

If code changes aren't reflected in HTTP responses, check for stale `bun keryx` processes:
```bash
ps aux | grep "bun keryx" | grep -v grep
kill -9 <PIDs>
```
