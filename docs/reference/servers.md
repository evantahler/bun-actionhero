---
description: Server class and the built-in web server — HTTP routing, WebSocket handling, and static files via Bun.serve.
---

# Servers

Source: `backend/classes/Server.ts`, `backend/servers/web.ts`

Servers are the transport layer — they accept incoming connections and route them to actions. The framework ships with a single web server that handles both HTTP and WebSocket via `Bun.serve`. You could add others (gRPC, raw TCP, etc.) by extending the `Server` base class.

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

The CLI isn't technically a server — it's a separate entry point (`actionhero.ts`) that uses [Commander](https://github.com/tj/commander.js) to register every action as a CLI command. But it goes through the same `Connection → act()` pipeline as HTTP and WebSocket.

The server boots in `RUN_MODE.CLI`, which tells initializers to skip transport-specific setup (like binding to a port). After the action executes, the process exits with the appropriate exit code.

```bash
# List all available actions
./actionhero.ts actions

# Run an action
./actionhero.ts "user:create" --name Evan --email evan@example.com --password secret -q | jq

# Start the full server
./actionhero.ts start
```
