---
description: How Keryx compares to Hono, Elysia, NestJS, FastAPI, and Django across transports, type safety, and MCP support.
---

# Framework Comparisons

Every framework makes trade-offs. Here's where Keryx sits relative to the tools you're probably evaluating.

## Feature Matrix

| Feature             | Keryx | Hono    | Elysia | NestJS   | FastAPI | Django   |
| ------------------- | ----- | ------- | ------ | -------- | ------- | -------- |
| HTTP                | yes   | yes     | yes    | yes      | yes     | yes      |
| WebSocket           | yes   | adapter | yes    | yes      | yes     | channels |
| CLI commands        | yes   | —       | —      | limited  | —       | yes      |
| Background tasks    | yes   | —       | —      | Bull     | Celery  | Celery   |
| MCP tools           | yes   | —       | —      | —        | —       | —        |
| Unified controller  | yes   | —       | —      | —        | —       | —        |
| Type-safe responses | yes   | yes     | yes    | partial  | yes     | —        |
| OAuth 2.1 built-in  | yes   | —       | —      | Passport | —       | allauth  |

## vs Hono

Hono is excellent for edge HTTP. It runs everywhere — Cloudflare Workers, Deno, Bun, Node — and its middleware composition is elegant. If you need multi-runtime edge deployment and nothing else, use Hono.

Where Keryx diverges: Hono is an HTTP router. If you need WebSocket handling, CLI commands, background tasks, and Model Context Protocol (MCP) tools from the same codebase, you're stitching together separate libraries. Keryx gives you one [action](/guide/actions) class that serves all five transports with shared validation and middleware.

Hono also doesn't have a built-in task runner or database layer. Keryx includes Resque-based [background tasks](/guide/tasks) with [fan-out](/guide/tasks#fan-out-pattern), Drizzle ORM with auto-migrations, and Redis PubSub [channels](/guide/channels) out of the box.

## vs Elysia

Both Keryx and Elysia are Bun-native and type-safe. Elysia focuses on HTTP performance and ergonomics — its Eden Treaty for end-to-end type safety is clever, and it benchmarks well for pure HTTP workloads.

Keryx takes a different bet: instead of optimizing one transport, it unifies all of them. Your `ActionResponse<T>` types flow to the frontend the same way Eden does, but your action also works as a WebSocket handler, CLI command, background task, and MCP tool without any extra code.

If you're building a pure HTTP API and performance is the top priority, Elysia is a strong choice. If you need your API to also be an MCP server that AI agents can discover and call — or you want built-in task scheduling, real-time channels, and CLI generation — that's Keryx.

## vs NestJS

NestJS is enterprise-grade with a huge ecosystem. If you want Angular-style architecture for your backend — decorators, dependency injection, separate modules per transport — NestJS has the most mature story in TypeScript.

Keryx is opinionated in a different direction. Instead of separate controllers, gateways, and processors for HTTP, WebSocket, and tasks, Keryx uses one action class for all transports. There's no DI container — the `api` singleton manages lifecycle, and initializers wire up services with explicit priority ordering.

NestJS also has no MCP story. If you need your API to double as an MCP server for AI agents, you're on your own. Keryx treats MCP as a first-class transport with built-in OAuth 2.1 authentication.

The trade-off: NestJS has more community packages and a larger hiring pool. Keryx has less ceremony and fewer files per feature.

## vs FastAPI

FastAPI set the bar for type-safe API frameworks. Pydantic validation, automatic OpenAPI docs, async by default — it proved that a modern web framework should validate inputs at the boundary and generate documentation for free.

Keryx brings that same developer experience to TypeScript. Zod schemas validate inputs, generate OpenAPI docs, power CLI `--help` text, and define MCP tool parameters — all from one definition. If you liked FastAPI's approach but work in TypeScript, Keryx is the closest equivalent.

The difference: FastAPI is HTTP-only by default. WebSocket support exists but it's separate from your route handlers. Background tasks need Celery. CLI tools need Typer. MCP needs a separate server. Keryx ships all of these as built-in transports on a single action class.

## vs Django

Django is batteries-included for web applications — admin panel, ORM, template engine, auth system, the works. It's the right choice for server-rendered apps where you want a proven, stable foundation.

Keryx is batteries-included for APIs and MCP. No template engine, no admin panel — instead you get transport-agnostic controllers, real-time WebSocket channels, background task scheduling, and an MCP server that lets AI agents call your API through the Model Context Protocol.

Different tools for different jobs. Django for server-rendered web apps with decades of stability. Keryx for API-first backends that need AI agent integration alongside traditional HTTP and WebSocket clients.

## vs MCP SDK (Bare)

If you're building for AI agents, you might consider using the `@modelcontextprotocol/sdk` directly. It's well-built — Keryx uses it internally. But the SDK gives you the protocol, not the framework.

With the bare SDK, you write tool handlers, manage sessions, build an auth layer, validate inputs, and wire up a transport — all by hand. With Keryx, you write an action with a Zod schema and get an MCP tool with OAuth 2.1, typed errors, input validation, middleware, and per-session isolation out of the box. Your action also works as an HTTP endpoint, WebSocket handler, CLI command, and background task — no extra code.

The SDK is the right choice if you need a standalone MCP server with no HTTP API alongside it. If your tools need a web API, a database, background tasks, or real-time channels too, that's Keryx.

## Agent Readiness

If you're evaluating frameworks for AI agent integration, here's what matters: Does it expose tools via MCP? Does auth work for non-browser clients? Can you control which endpoints agents see? Does each agent get isolated session state?

Keryx is the only framework in this comparison where MCP, OAuth, tool control, and per-session isolation work out of the box — without additional libraries or configuration. See the [Building for AI Agents](/guide/agents) guide for a walkthrough.

## The Honest Answer

If you're building an HTTP-only API, any of these frameworks will serve you well. Keryx shines when you need your API to also be a WebSocket server, a CLI tool, a background task runner, and an MCP server — without writing the same logic five times.
