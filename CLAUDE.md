# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A modern TypeScript framework built on Bun, spiritual successor to ActionHero. Monorepo with `backend/` (API server) and `frontend/` (Next.js app). The core idea: **Actions are the universal controller** - they serve as HTTP endpoints, WebSocket handlers, CLI commands, background tasks, and MCP tools simultaneously.

## Environment Setup

Backend requires a `backend/.env` file. In a fresh clone or new git worktree, copy from the example and adjust:

```bash
cp backend/.env.example backend/.env
```

The defaults in `.env.example` assume a local macOS PostgreSQL where your shell `$USER` is a superuser with no password (typical for Homebrew Postgres). If that matches your setup, no edits are needed.

Similarly for frontend:

```bash
cp frontend/.env.example frontend/.env
```

## Common Commands

All commands from root unless noted. Backend tests require PostgreSQL (`bun` and `bun-test` databases) and Redis running locally.

```bash
bun install                        # Install all dependencies
bun dev                            # Run both backend and frontend with hot reload
bun run ci                         # Full CI: lint + test both apps

# Backend only (run from backend/)
cd backend
bun test                           # Run all backend tests (uses bun:test, non-concurrent)
bun test __tests__/actions/user.test.ts  # Run a single test file
bun run dev                        # Backend only with --watch
bun run start                      # Start server
bun lint                           # Check formatting (prettier)
bun format                         # Fix formatting (prettier)
bun run migrations                 # Generate DB migrations from schema changes
```

## Architecture

### Global Singleton: `api`
The `api` object (`backend/api.ts`) is a global singleton stored on `globalThis`. It manages the full lifecycle: initialize -> start -> stop. All initializers attach their namespaces to it (e.g., `api.db`, `api.actions`, `api.redis`).

### Actions (`backend/actions/`, `backend/classes/Action.ts`)
Transport-agnostic controllers. Every action defines:
- `inputs`: Zod schema for validation and type inference
- `web`: `{ route, method }` for HTTP routing (routes are regex or string with `:param` path params, defined on the action itself)
- `task`: `{ queue, frequency }` for background job scheduling
- `middleware`: Array of `ActionMiddleware` (e.g., `SessionMiddleware` for auth)
- `run(params, connection)`: The handler. **Must throw `TypedError`** for errors.
- `mcp`: `McpActionConfig` — `{ enabled, isLoginAction, isSignupAction }` (default `{ enabled: true }`)

Type helpers: `ActionParams<A>` infers input types, `ActionResponse<A>` infers return types.

New actions must be re-exported from `backend/actions/.index.ts` for frontend type sharing.

### Initializers (`backend/initializers/`, `backend/classes/Initializer.ts`)
Lifecycle components with priority-based ordering. Each initializer:
1. Uses **module augmentation** to extend the `API` interface with its namespace
2. Returns its namespace object from `initialize()`
3. Connects to services in `start()`, cleans up in `stop()`

Pattern (see `backend/initializers/db.ts`):
```typescript
declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<MyInitializer["initialize"]>>;
  }
}
```

Key initializers and their priorities: `actions` (100), `db` (100), `redis` (default), `pubsub` (150), `swagger` (150), `oauth` (175), `mcp` (200/560/90), `resque` (250), `application` (1000).

### Fan-Out Tasks (`backend/initializers/actionts.ts`)
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

### Channels (`backend/classes/Channel.ts`)
PubSub channels for WebSocket real-time messaging. Channels define a `name` (string or RegExp pattern) and optional `middleware` (ChannelMiddleware) for authorization on subscribe and cleanup on unsubscribe.

### Servers (`backend/servers/web.ts`)
WebServer uses `Bun.serve` for HTTP + WebSocket. Handles routing, static files, cookies, and session management.

### MCP Server & OAuth (`backend/initializers/mcp.ts`, `backend/initializers/oauth.ts`)
MCP (Model Context Protocol) server that exposes actions as tools for AI agents. Enabled via `MCP_SERVER_ENABLED=true`.

- **Tool registration**: All actions with `mcp.enabled !== false` are registered. Names convert `:` → `-`. Zod schemas are sanitized for `zod/v4-mini` compatibility before JSON Schema conversion.
- **OAuth 2.1 endpoints**: `/.well-known/oauth-protected-resource`, `/.well-known/oauth-authorization-server`, `/oauth/register`, `/oauth/authorize` (GET/POST), `/oauth/token`
- **Login/signup markers**: Actions tagged with `mcp.isLoginAction` or `mcp.isSignupAction` are invoked during the OAuth authorization flow. Must return `OAuthActionResponse` (`{ user: { id: number } }`).
- **Redis keys**: `oauth:client:{id}` (TTL 30d), `oauth:code:{code}` (TTL 5m), `oauth:token:{token}` (TTL = session TTL)
- **Templates**: HTML pages for OAuth login/signup flow live in `backend/templates/`
- **Per-session McpServer**: Each authenticated session creates its own `McpServer` instance, tracked via `mcp-session-id` header.

### Config (`backend/config/`)
Modular config with per-environment overrides via `loadFromEnvIfSet()` — checks `ENV_VAR_NODEENV` first, then `ENV_VAR`, then falls back to the default value. Type-aware (auto-parses booleans and numbers).

### Ops (`backend/ops/`)
Business logic layer (e.g., `UserOps`, `MessageOps`) separating DB operations from actions.

### Schemas (`backend/schema/`)
Drizzle ORM table definitions. Migrations auto-apply on server start when `config.database.autoMigrate` is true.

### Zod Helpers (`backend/util/zodMixins.ts`)
- `secret(schema)`: Wraps a Zod schema so the field is redacted as `[[secret]]` in logs. Uses Zod v4 `.meta()` API.
- `zIdOrModel(table, ...)` / `zUserIdOrModel()` / `zMessageIdOrModel()`: Accepts an ID or full object and auto-resolves via DB using async transforms.
- `zBooleanFromString()`: Parses `"true"`/`"false"` strings from form data into booleans.

### TypedError (`backend/classes/TypedError.ts`)
All action errors must use `TypedError` with an `ErrorType` enum. Each error type maps to an HTTP status code via `ErrorStatusCodes`.

## Coding Conventions

- **No `as any`** — Never use `as any` type assertions. Use `@ts-expect-error` with an explanatory comment when the type system can't express something, or add a proper type/interface.

## Testing Patterns

Tests use Bun's built-in test runner. Each test file boots/stops the full server:

```typescript
import { api } from "../../api";
import { config } from "../../config";
const url = config.server.web.applicationUrl;

beforeAll(async () => { await api.start(); });
afterAll(async () => { await api.stop(); });

test("...", async () => {
  const res = await fetch(url + "/api/status");
  const body = (await res.json()) as ActionResponse<Status>;
});
```

Tests make real HTTP requests via `fetch` - no mock server. Tests run non-concurrently to avoid port conflicts.

**Every code change should include tests.** When adding features, fixing bugs, or modifying behavior, always write or update tests to cover the change. If a PR has no test changes, that's a red flag.

### Auto-discovery
Actions, initializers, and servers are auto-discovered via `globLoader` (`backend/util/glob.ts`), which scans directories for `*.ts` files and instantiates all exported classes. Files prefixed with `.` are skipped.

## Documentation Site (`docs/`)

VitePress site deployed to `keryxjs.com` via GitHub Pages. Key commands:

```bash
bun docs:dev                       # Preview docs locally
bun docs:build                     # Generate reference data + build static site
cd docs && bun run generate        # Regenerate reference JSON from backend source
```

**Important**: When modifying backend code (actions, initializers, config, classes), consider updating the corresponding documentation in `docs/guide/` or `docs/reference/`. The reference pages (`docs/reference/actions.md`, `initializers.md`, `config.md`) are auto-generated from source via `docs/scripts/generate-docs-data.ts`, but the guide pages (`docs/guide/*.md`) are hand-written and need manual updates.

The landing page includes `README.md` via VitePress markdown includes (`<!--@include: ../README.md-->`), so README changes automatically appear on the site.

## Gotcha: Stale Processes

If code changes aren't reflected in HTTP responses, check for stale `bun keryx` processes:
```bash
ps aux | grep "bun keryx" | grep -v grep
kill -9 <PIDs>
```
