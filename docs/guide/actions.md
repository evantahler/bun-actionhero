---
description: Actions are the universal controller — one class handles HTTP, WebSocket, CLI, background tasks, and MCP.
---

# Actions

If there's one idea that defines Keryx, it's this: **actions are the universal controller**. In the original ActionHero, we had actions, tasks, and CLI commands as separate concepts. That always felt like unnecessary duplication — you'd write the same validation logic three times for three different entry points. So in this version, we've collapsed them all into one thing.

An action is a class with a `name`, a Zod schema for `inputs`, and a `run()` method that returns data. You add a `web` property to make it an HTTP endpoint. You add a `task` property to make it a background job. CLI support comes for free. MCP tool exposure comes for free. Same validation, same error handling, same response shape — everywhere.

## A Simple Example

```ts
import { z } from "zod";
import { Action, api } from "../api";
import { HTTP_METHOD } from "../classes/Action";

export class Status implements Action {
  name = "status";
  description = "Return the status of the server";
  inputs = z.object({});
  web = { route: "/status", method: HTTP_METHOD.GET };

  async run() {
    return {
      name: api.process.name,
      uptime: new Date().getTime() - api.bootTime,
    };
  }
}
```

That's a fully functioning HTTP endpoint, CLI command, and WebSocket handler. Hit `GET /api/status` from a browser, run `./keryx.ts status -q | jq` from the terminal, or send `{ action: "status" }` over a WebSocket — same action, same response.

## Properties

| Property      | Type                    | What it does                                                                   |
| ------------- | ----------------------- | ------------------------------------------------------------------------------ |
| `name`        | `string`                | Unique identifier (e.g., `"user:create"`)                                      |
| `description` | `string`                | Human-readable description, shows up in CLI `--help` and Swagger               |
| `inputs`      | `z.ZodType`             | Zod schema — validation happens automatically                                  |
| `web`         | `{ route, method }`     | HTTP routing. Routes are strings with `:param` placeholders or RegExp patterns |
| `task`        | `{ queue, frequency? }` | Makes this action schedulable as a background job                              |
| `middleware`  | `ActionMiddleware[]`    | Runs before/after the action (auth, logging, etc.)                             |
| `mcp`         | `McpActionConfig`       | Controls MCP tool exposure (default: enabled)                                  |

## Input Validation

Inputs use [Zod](https://zod.dev) schemas. If validation fails, the client gets a `422` with the validation errors — you don't need to write any error handling for bad inputs.

```ts
inputs = z.object({
  name: z.string().min(3).max(256),
  email: z
    .string()
    .email()
    .transform((val) => val.toLowerCase()),
  password: secret(z.string().min(8)),
});
```

### Secret Fields

You can mark sensitive fields with the `secret()` wrapper so they're redacted as `[[secret]]` in logs. Don't log passwords — use this:

```ts
import { secret } from "../util/zodMixins";

inputs = z.object({
  password: secret(z.string().min(8)),
});
```

### Type Helpers

Two type helpers make your life easier:

- `ActionParams<A>` infers the validated input type from an action's Zod schema
- `ActionResponse<A>` infers the return type of an action's `run()` method

```ts
async run(params: ActionParams<UserCreate>) {
  // params.name, params.email, params.password — all typed
}
```

The frontend uses `ActionResponse<A>` to get type-safe API responses without any code generation.

## Web Routes

Add a `web` property to expose an action as an HTTP endpoint:

```ts
web = { route: "/user/:id", method: HTTP_METHOD.GET };
```

Routes support `:param` path parameters (like Express) and can also be RegExp patterns. There's no separate `routes.ts` file — the route lives on the action itself, right next to the handler that serves it.

Available methods: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `OPTIONS`.

## CLI Commands

Every action is automatically available as a CLI command. No extra configuration needed:

```bash
./keryx.ts "user:create" --name evan --email "evan@example.com" --password secret -q | jq
```

The `-q` flag suppresses server logs so you can pipe the JSON output cleanly. Use `--help` on any action to see its parameters.

## MCP Tools

When the MCP server is enabled, every action is automatically exposed as an [MCP](https://modelcontextprotocol.io) tool. AI agents can discover and call your actions through the Model Context Protocol — no extra configuration needed.

To exclude an action from MCP, set `mcp = { enabled: false }`. See the [MCP guide](/guide/mcp) for full details on authentication, schema conversion, and configuration.

## Task Scheduling

Add a `task` property to schedule an action as a recurring background job:

```ts
task = { queue: "default", frequency: 1000 * 60 * 60 }; // every hour
```

- `queue` — which Resque queue to use
- `frequency` — optional interval in ms for recurring execution

See [Tasks](/guide/tasks) for the full story on background processing and the fan-out pattern.

## Error Handling

Actions should throw `TypedError` for errors — not generic `Error`. Each error type maps to an HTTP status code:

```ts
import { ErrorType, TypedError } from "../classes/TypedError";

throw new TypedError({
  message: "User not found",
  type: ErrorType.CONNECTION_ACTION_RUN, // → 400
});
```

Some common mappings: `ACTION_VALIDATION` → 422, `CONNECTION_SESSION_NOT_FOUND` → 401, `CONNECTION_ACTION_NOT_FOUND` → 404.

## Registration

New actions need to be re-exported from `backend/actions/.index.ts`. This is how the frontend gets type information about your API — it imports from that barrel file to power `ActionResponse<A>` on the client side.
