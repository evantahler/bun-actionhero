# Keryx

<p align="center"><strong>Keryx is the messenger of the gods, and the greatest framework for building realtime AI, CLI, and web applications.</strong></p>

<p align="center">
  <img src="https://raw.githubusercontent.com/evantahler/keryx/main/docs/public/images/horn.svg" alt="Keryx" width="200" />
</p>

[![Test](https://github.com/evantahler/keryx/actions/workflows/test.yaml/badge.svg)](https://github.com/evantahler/keryx/actions/workflows/test.yaml)

## What is this Project?

This is a modern rewrite of [ActionHero](https://www.actionherojs.com), built on [Bun](https://bun.sh). I still believe in the core ideas behind ActionHero — it was an attempt to take the best ideas from Rails and Node.js and shove them together — but the original framework needed a fresh start with modern tooling.

The big idea: **write your controller once, and it works everywhere**. A single action class handles HTTP requests, WebSocket messages, CLI commands, background tasks, and MCP tool calls — same inputs, same validation, same middleware, same response. No duplication.

### One Action, Every Transport

Here's what that looks like in practice. This is one action:

```ts
export class UserCreate implements Action {
  name = "user:create";
  description = "Create a new user";
  inputs = z.object({
    name: z.string().min(3),
    email: z.string().email(),
    password: secret(z.string().min(8)),
  });
  web = { route: "/user", method: HTTP_METHOD.PUT };
  task = { queue: "default" };

  async run(params: ActionParams<UserCreate>) {
    const user = await createUser(params);
    return { user: serializeUser(user) };
  }
}
```

That one class gives you:

**HTTP** — `PUT /api/user` with JSON body, query params, or form data:
```bash
curl -X PUT http://localhost:8080/api/user \
  -H "Content-Type: application/json" \
  -d '{"name":"Evan","email":"evan@example.com","password":"secret123"}'
```

**WebSocket** — send a JSON message over an open connection:
```json
{ "messageType": "action", "action": "user:create",
  "params": { "name": "Evan", "email": "evan@example.com", "password": "secret123" } }
```

**CLI** — flags are generated from the Zod schema automatically:
```bash
./keryx.ts "user:create" --name Evan --email evan@example.com --password secret123 -q | jq
```

**Background Task** — enqueued to a Resque worker via Redis:
```ts
await api.actions.enqueue("user:create", { name: "Evan", email: "evan@example.com", password: "secret123" });
```

**MCP** — exposed as a tool for AI agents automatically:
```json
{
  "mcpServers": {
    "my-app": {
      "url": "http://localhost:8080/mcp"
    }
  }
}
```

Same validation, same middleware chain, same `run()` method, same response shape. The only thing that changes is how the request arrives and how the response is delivered.

### Key Components

- **Transport-agnostic Actions** — HTTP, WebSocket, CLI, background tasks, and MCP from one class
- **Zod input validation** — type-safe params with automatic error responses and OpenAPI generation
- **Built-in background tasks** via [node-resque](https://github.com/actionhero/node-resque), with a [fan-out pattern](#fan-out-tasks) for parallel job processing
- **Strongly-typed frontend integration** — `ActionResponse<MyAction>` gives the frontend type-safe API responses, no code generation needed
- **Drizzle ORM** with auto-migrations (replacing the old `ah-sequelize-plugin`)
- **Companion Next.js frontend** as a separate application (replacing `ah-next-plugin`)

### Why Bun?

TypeScript is still the best language for web APIs. But Node.js has stalled — Bun is moving faster and includes everything we need out of the box:

- Native TypeScript — no compilation step
- Built-in test runner
- Module resolution that just works
- Fast startup and an excellent packager
- `fetch` included natively — great for testing

## Project Structure

- **root** — a slim `package.json` wrapping the workspaces. `bun install` and `bun dev` work here, but you need to `cd` into each workspace for tests.
- **packages/keryx** — the framework package (publishable)
- **example/backend** — the example backend application
- **example/frontend** — the example Next.js frontend
- **docs** — the [documentation site](https://keryxjs.com)

## Quick Start

Create a new project:

```bash
bunx keryx new my-app
cd my-app
cp .env.example .env
bun install
bun dev
```

Requires Bun, PostgreSQL, and Redis. See the [Getting Started guide](https://keryxjs.com/guide/) for full setup instructions.

### Developing the framework itself

If you're contributing to Keryx, clone the monorepo instead:

```bash
git clone https://github.com/evantahler/keryx.git
cd keryx
bun install
cp example/backend/.env.example example/backend/.env
cp example/frontend/.env.example example/frontend/.env
bun dev
```

## Production Builds

```bash
bun compile
# set NODE_ENV=production in .env
bun start
```

## Databases and Migrations

We use [Drizzle](https://orm.drizzle.team) as the ORM. Migrations are derived from schemas — edit your schema files in `schema/*.ts`, then generate and apply:

```bash
cd example/backend && bun run migrations
# restart the server — pending migrations auto-apply
```

## Actions, CLI Commands, and Tasks

Unlike the original ActionHero, we've removed the distinction between actions, CLI commands, and tasks. They're all the same thing now. You can run any action from the CLI, schedule any action as a background task, call any action via HTTP or WebSocket, and expose any action as an MCP tool for AI agents. Same input validation, same responses, same middleware.

### Web Actions

Add a `web` property to expose an action as an HTTP endpoint. Routes support `:param` path parameters and RegExp patterns — the route lives on the action itself, no separate `routes.ts` file:

```ts
web = { route: "/user/:id", method: HTTP_METHOD.GET };
```

### WebSocket Actions

Enabled by default. Clients send JSON messages with `{ messageType: "action", action: "user:create", params: { ... } }`. The server validates params through the same Zod schema and sends the response back over the socket. WebSocket connections also support channel subscriptions for real-time PubSub.

### CLI Actions

Enabled by default. Every action is registered as a CLI command via [Commander](https://github.com/tj/commander.js). The Zod schema generates `--flags` and `--help` text automatically:

```bash
./keryx.ts "user:create" --name evan --email "evantahler@gmail.com" --password password -q | jq
```

The `-q` flag suppresses logs so you get clean JSON. Use `--help` on any action to see its params.

### Task Actions

Add a `task` property to schedule an action as a background job. A `queue` is required, and `frequency` is optional for recurring execution:

```ts
task = { queue: "default", frequency: 1000 * 60 * 60 }; // every hour
```

### MCP Actions

When the MCP server is enabled (`MCP_SERVER_ENABLED=true`), every action is automatically registered as an [MCP](https://modelcontextprotocol.io) tool. AI agents and LLM clients (Claude Desktop, VS Code, etc.) can discover and call your actions through the standard Model Context Protocol.

Action names are converted to valid MCP tool names by replacing `:` with `-` (e.g., `user:create` becomes `user-create`). The action's Zod schema is converted to JSON Schema for tool parameter definitions.

To exclude an action from MCP:

```ts
mcp = { enabled: false };
```

OAuth 2.1 with PKCE is used for authentication — MCP clients go through a browser-based login flow, and subsequent tool calls carry a Bearer token tied to the authenticated user's session.

### Fan-Out Tasks

A parent task can distribute work across many child jobs using `api.actions.fanOut()` for parallel processing. Results are collected automatically in Redis. See the [Tasks guide](https://keryxjs.com/guide/tasks) for full API and examples.

## Coming from ActionHero?

Keryx keeps the core ideas but rewrites everything with modern tooling. The biggest changes: unified controllers (actions = tasks = CLI commands = MCP tools), separate frontend/backend applications, Drizzle ORM, and MCP as a first-class transport.

See the full [migration guide](https://keryxjs.com/guide/from-actionhero) for details.

## Production Deployment

Each application has its own `Dockerfile`, and a `docker-compose.yml` runs them together. You probably won't use this exact setup in production, but it shows how the pieces fit together.

## Documentation

Full docs at [keryxjs.com](https://keryxjs.com), including:
- [Getting Started](https://keryxjs.com/guide/)
- [Actions Guide](https://keryxjs.com/guide/actions)
- [API Reference](https://keryxjs.com/reference/actions)

<p align="center">
  <img src="https://raw.githubusercontent.com/evantahler/keryx/main/docs/public/images/lion-standing.svg" alt="Keryx lion" width="120" />
</p>
