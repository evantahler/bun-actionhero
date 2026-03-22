---
name: architecture
description: Framework internals quick-reference — api singleton, actions, initializers, module augmentation, servers, MCP, config
when_to_use: |
  - User is writing or modifying framework code in packages/keryx/
  - User needs to understand how subsystems connect
  - User is creating new actions, initializers, channels, or middleware
  - User asks about the api singleton, dual-directory loading, or lifecycle
keywords: [action, initializer, channel, server, mcp, oauth, config, middleware, connection, typed-error, zod, fan-out, task, api, singleton, lifecycle]
---

# Architecture Quick-Reference

For full details, read the corresponding doc files listed below.

## Dual-Directory Loading

The framework loads from both `packageDir` (auto-resolved from `import.meta.path`) and `rootDir` (set by the user app). Actions, initializers, and servers are auto-discovered via `globLoader` (`packages/keryx/util/glob.ts`) from both directories. Files prefixed with `.` are skipped.

```typescript
import { api } from "keryx";
api.rootDir = import.meta.dir; // User sets this before api.initialize()
```

## Global Singleton: `api`

`packages/keryx/api.ts` — stored on `globalThis`. Lifecycle: initialize -> start -> stop. All initializers attach namespaces (e.g., `api.db`, `api.actions`, `api.redis`).

## Actions (`docs/guide/actions.md`)

Transport-agnostic controllers. Key properties:
- `inputs` — Zod schema
- `web` — `{ route, method }` for HTTP
- `task` — `{ queue, frequency }` for background jobs
- `middleware` — Array of `ActionMiddleware`
- `run(params, connection, abortSignal?)` — handler, must throw `TypedError` for errors
- `timeout` — per-action ms (default 300s, `0` to disable)
- `mcp` — `{ tool, isLoginAction, isSignupAction, resource?, prompt? }`

Type helpers: `ActionParams<A>`, `ActionResponse<A>`.

App actions must be re-exported from `example/backend/actions/.index.ts` for frontend type sharing.

## Initializers (`docs/guide/initializers.md`)

Priority-based lifecycle components. Each uses **module augmentation** to extend `API`:

Framework (relative):
```typescript
declare module "../classes/API" {
  export interface API { [namespace]: Awaited<ReturnType<MyInit["initialize"]>>; }
}
```

App (package):
```typescript
declare module "keryx" {
  export interface API { [namespace]: Awaited<ReturnType<MyInit["initialize"]>>; }
}
```

Key priorities: `observability` (50), `actions` (100), `db` (100), `pubsub` (150), `swagger` (150), `oauth` (175), `redis` (200), `mcp` (200/560/90), `resque` (250), `application` (1000).

## MCP & OAuth (`docs/guide/mcp.md`)

Enabled via `MCP_SERVER_ENABLED=true`. Actions with `mcp.tool !== false` become tools (names convert `:` → `-`). OAuth 2.1 endpoints at `/.well-known/oauth-*`, `/oauth/*`. Per-session `McpServer` instances tracked via `mcp-session-id` header.

## Config (`docs/guide/config.md`)

Modular config in `packages/keryx/config/`. Uses `loadFromEnvIfSet()` — checks `ENV_VAR_NODEENV` first, then `ENV_VAR`, then default. Auto-parses booleans and numbers.

## Other Subsystems

- **Channels** (`docs/guide/channels.md`) — PubSub for WebSocket, pattern matching, middleware auth
- **Servers** (`docs/reference/servers.md`) — `Bun.serve` HTTP + WebSocket, split into `webRouting.ts`, `webSocket.ts`, `webCompression.ts`, `webResponse.ts`, `webStaticFiles.ts`
- **Fan-Out Tasks** (`docs/guide/tasks.md`) — `api.actions.fanOut()` distributes work across child jobs, results collected in Redis
- **TypedError** (`docs/reference/classes.md`) — All action errors use `TypedError` with `ErrorType` enum mapping to HTTP status codes
- **Zod Helpers** (`docs/reference/utilities.md`) — `secret()`, `isSecret()`, `zBooleanFromString()`, `zIdOrModel()`
- **CLI Generators** (`docs/guide/cli.md`) — `keryx generate <type> <name>` scaffolds from Mustache templates
