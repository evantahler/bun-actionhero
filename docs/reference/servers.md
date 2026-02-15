---
description: Server class and the built-in transports — HTTP, WebSocket, CLI, and MCP via Bun.serve.
---

# Servers

Source: `backend/classes/Server.ts`, `backend/servers/web.ts`, `backend/initializers/mcp.ts`

Servers are the transport layer — they accept incoming connections and route them to actions. The framework ships with a web server (HTTP + WebSocket via `Bun.serve`), a CLI entry point, and an MCP server for AI agents. You could add others (gRPC, raw TCP, etc.) by extending the `Server` base class.

## Server Base Class

```ts
abstract class Server<T> {
  name: string;

  /** The underlying server object (e.g., Bun.Server) */
  server?: T;

  abstract initialize(): Promise<void>;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
}
```

Servers are auto-discovered from the `servers/` directory, just like actions and initializers.

## WebServer

The built-in web server uses `Bun.serve` to handle HTTP requests and WebSocket connections on the same port. It's configured via `config.server.web`.

### HTTP Request Flow

When an HTTP request comes in, the server:

1. Checks for a WebSocket upgrade — if the client is requesting a WebSocket connection, it upgrades transparently
2. Tries to serve a static file (if `staticFilesEnabled` is `true` and the path matches)
3. Matches the request path and method against registered action routes
4. Extracts params from path segments (`:param`), query string, and request body
5. Creates a `Connection`, calls `connection.act()` with the action name and params
6. Returns the JSON response with appropriate headers and status codes

Param loading order matters — later sources override earlier ones:

1. **Path params** (e.g., `/user/:id` → `{ id: "123" }`)
2. **Query params** (e.g., `?limit=10`)
3. **Body params** (JSON or FormData)

### WebSocket Message Flow

WebSocket connections are long-lived. After the initial HTTP upgrade, the client sends JSON messages with a `messageType` field:

| messageType     | What it does                                                  |
| --------------- | ------------------------------------------------------------- |
| `"action"`      | Execute an action — same validation and middleware as HTTP    |
| `"subscribe"`   | Subscribe to a PubSub channel (with middleware authorization) |
| `"unsubscribe"` | Unsubscribe from a channel                                    |

Action messages include `action`, `params`, and an optional `messageId` that's echoed back in the response so the client can correlate requests.

### Static Files

The web server can serve static files from a configured directory (default: `assets/`). This is useful for serving the frontend build output or other static assets alongside the API.

### Configuration

All web server settings are in `config.server.web`:

| Key                    | Default       | What it does                  |
| ---------------------- | ------------- | ----------------------------- |
| `enabled`              | `true`        | Enable/disable the web server |
| `port`                 | `8080`        | Listen port                   |
| `host`                 | `"localhost"` | Bind address                  |
| `apiRoute`             | `"/api"`      | URL prefix for action routes  |
| `allowedOrigins`       | `"*"`         | CORS allowed origins          |
| `staticFilesEnabled`   | `true`        | Serve static files            |
| `staticFilesDirectory` | `"assets"`    | Directory for static files    |

## CLI "Server"

The CLI isn't technically a server — it's a separate entry point (`keryx.ts`) that uses [Commander](https://github.com/tj/commander.js) to register every action as a CLI command. But it goes through the same `Connection → act()` pipeline as HTTP and WebSocket.

The server boots in `RUN_MODE.CLI`, which tells initializers to skip transport-specific setup (like binding to a port). After the action executes, the process exits with the appropriate exit code.

```bash
# List all available actions
./keryx.ts actions

# Run an action
./keryx.ts "user:create" --name Evan --email evan@example.com --password secret -q | jq

# Start the full server
./keryx.ts start
```

## MCP Server

Source: `backend/initializers/mcp.ts`, `backend/initializers/oauth.ts`

The [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server exposes actions as tools for AI agents. Unlike the web server and CLI, MCP is implemented as an initializer rather than a `Server` subclass — but it follows the same pattern of accepting requests and routing them through `Connection → act()`.

When enabled (`MCP_SERVER_ENABLED=true`), the MCP initializer:

1. Registers every action (where `mcp.enabled !== false`) as an MCP tool
2. Converts action names from `:` to `-` format (e.g., `user:create` → `user-create`)
3. Converts Zod input schemas to JSON Schema for tool parameter definitions
4. Handles Streamable HTTP transport at the configured route (default `/mcp`)

Each authenticated client gets its own `McpServer` instance, tracked by the `mcp-session-id` header.

### Authentication

MCP uses OAuth 2.1 with PKCE for authentication. The OAuth initializer (`backend/initializers/oauth.ts`) provides the required endpoints:

| Endpoint                                  | Method | Purpose                           |
| ----------------------------------------- | ------ | --------------------------------- |
| `/.well-known/oauth-protected-resource`   | GET    | Resource metadata (RFC 9728)      |
| `/.well-known/oauth-authorization-server` | GET    | Authorization server metadata     |
| `/oauth/register`                         | POST   | Dynamic client registration       |
| `/oauth/authorize`                        | GET    | Authorization page (login/signup) |
| `/oauth/authorize`                        | POST   | Process login/signup              |
| `/oauth/token`                            | POST   | Exchange code for access token    |

The authorization page is rendered from Mustache templates in `backend/templates/`. Actions tagged with `mcp.isLoginAction` or `mcp.isSignupAction` handle the actual authentication during the OAuth flow.

### Request Flow

1. MCP client sends a POST to `/mcp` with `Authorization: Bearer <token>`
2. The initializer verifies the token against Redis (`oauth:token:{token}`)
3. A new `Connection` is created with type `"mcp"` and the authenticated user's session
4. Action params are extracted from the MCP tool call arguments
5. `connection.act()` executes the action through the standard middleware pipeline
6. The result is returned as an MCP tool response

### Configuration

| Key              | Env Var                | Default   |
| ---------------- | ---------------------- | --------- |
| `enabled`        | `MCP_SERVER_ENABLED`   | `false`   |
| `route`          | `MCP_SERVER_ROUTE`     | `"/mcp"`  |
| `oauthClientTtl` | `MCP_OAUTH_CLIENT_TTL` | `2592000` |
| `oauthCodeTtl`   | `MCP_OAUTH_CODE_TTL`   | `300`     |

See the [MCP guide](/guide/mcp) for full usage details.
