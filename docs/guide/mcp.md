---
description: Expose your actions as MCP tools for AI agents, with built-in OAuth 2.1 authentication.
---

# MCP Server

[MCP (Model Context Protocol)](https://modelcontextprotocol.io) is an open standard for connecting AI agents to external tools and data sources. In Keryx, MCP is a natural extension of the transport-agnostic action model — just like an action can serve HTTP, WebSocket, CLI, and background tasks, it can also be exposed as an MCP tool for AI agents.

## Enabling the MCP Server

The MCP server is disabled by default. Enable it with an environment variable:

```bash
MCP_SERVER_ENABLED=true
```

Or set it directly in `backend/config/server/mcp.ts`:

```ts
export const configServerMcp = {
  enabled: true,
  route: "/mcp",
  // ...
};
```

Once enabled, the server listens at `http://localhost:8080/mcp` (or your configured `applicationUrl` + `route`).

## How Actions Become Tools

When the MCP server starts, it registers every action as an MCP tool automatically. No extra configuration needed — if an action exists, it becomes a tool.

For each action:

1. **Name** — The action name is converted to a valid MCP tool name by replacing `:` with `-` (e.g., `user:create` → `user-create`)
2. **Description** — The action's `description` property becomes the tool description
3. **Input schema** — The action's Zod `inputs` schema is converted to JSON Schema for tool parameter definitions

```ts
// This action...
export class UserView extends Action {
  name = "user:view";
  description = "View a user's profile";
  inputs = z.object({ userId: z.string() });
  // ...
}

// ...becomes MCP tool "user-view" with:
// - description: "View a user's profile"
// - inputSchema: { type: "object", properties: { userId: { type: "string" } } }
```

## Controlling Exposure

By default, all actions are exposed as MCP tools. To exclude an action:

```ts
export class InternalAction extends Action {
  name = "internal:cleanup";
  mcp = { enabled: false };
  // ...
}
```

The full `mcp` property is of type `McpActionConfig`:

| Property         | Type      | Default | Description                                  |
| ---------------- | --------- | ------- | -------------------------------------------- |
| `enabled`        | `boolean` | `true`  | Whether to expose this action as an MCP tool |
| `isLoginAction`  | `boolean` | —       | Tag as the login action for the OAuth flow   |
| `isSignupAction` | `boolean` | —       | Tag as the signup action for the OAuth flow  |

The `isLoginAction` and `isSignupAction` markers tell the OAuth system which actions to invoke when users authenticate through the MCP authorization page. These actions must return `OAuthActionResponse` (`{ user: { id: number } }`).

## Schema Sanitization

The MCP SDK's internal JSON Schema converter (`zod/v4-mini`'s `toJSONSchema`) doesn't support all Zod types (e.g., `z.date()`). The MCP initializer tests each field individually and replaces incompatible fields with `z.string()` as a fallback, so your tools always register successfully even if some input types need coercion.

## OAuth 2.1 Authentication

MCP clients authenticate using OAuth 2.1 with PKCE (Proof Key for Code Exchange). The flow is:

1. MCP client connects to `/mcp` and receives a `401` response
2. Client fetches `/.well-known/oauth-protected-resource` to discover the authorization server
3. Client fetches `/.well-known/oauth-authorization-server` for endpoints
4. Client registers dynamically via `POST /oauth/register`
5. Client opens a browser to `/oauth/authorize` with PKCE challenge
6. User logs in or signs up on the authorization page
7. Server issues an authorization code and redirects back
8. Client exchanges the code for an access token at `POST /oauth/token`
9. Client includes `Authorization: Bearer <token>` on subsequent MCP requests

### OAuth Endpoints

| Endpoint                                  | Method | Description                            |
| ----------------------------------------- | ------ | -------------------------------------- |
| `/.well-known/oauth-protected-resource`   | GET    | Resource metadata (RFC 9728)           |
| `/.well-known/oauth-authorization-server` | GET    | Authorization server metadata          |
| `/oauth/register`                         | POST   | Dynamic client registration            |
| `/oauth/authorize`                        | GET    | Authorization page (login/signup form) |
| `/oauth/authorize`                        | POST   | Process login/signup form submission   |
| `/oauth/token`                            | POST   | Exchange authorization code for token  |

### Security

The OAuth implementation includes several hardening measures:

- **Redirect URI validation** — URIs registered via `/oauth/register` must not contain fragments or userinfo, and must use HTTPS for non-localhost addresses. When exchanging authorization codes, the redirect URI must match the registered URI exactly (origin + pathname).
- **Registration rate limiting** — `POST /oauth/register` has a separate, stricter rate limit (default: 5 requests per hour per IP) to prevent abuse. See `RATE_LIMIT_OAUTH_REGISTER_LIMIT` and `RATE_LIMIT_OAUTH_REGISTER_WINDOW_MS` in [Configuration](/guide/config).
- **CORS** — OAuth and MCP endpoints respect the `allowedOrigins` configuration. When `allowedOrigins` is `"*"`, credentials headers are not sent, per the browser spec. Set a specific origin in production for credentialed requests to work.

## Session Management

Each authenticated MCP connection creates its own `McpServer` instance. Sessions are tracked via the `mcp-session-id` header — the MCP SDK generates a UUID per session and includes it in all subsequent requests.

When a session closes, the transport and server instance are cleaned up automatically.

## PubSub Notifications

When messages are broadcast through the PubSub system (e.g., chat messages sent via Redis PubSub), they are forwarded to all connected MCP clients as MCP logging messages. This allows AI agents to receive real-time notifications about events happening in your application.

## Configuration Reference

| Key              | Env Var                | Default   | Description                             |
| ---------------- | ---------------------- | --------- | --------------------------------------- |
| `enabled`        | `MCP_SERVER_ENABLED`   | `false`   | Enable the MCP server                   |
| `route`          | `MCP_SERVER_ROUTE`     | `"/mcp"`  | URL path for the MCP endpoint           |
| `oauthClientTtl` | `MCP_OAUTH_CLIENT_TTL` | `2592000` | OAuth client registration TTL (seconds) |
| `oauthCodeTtl`   | `MCP_OAUTH_CODE_TTL`   | `300`     | Authorization code TTL (seconds)        |

## Testing

You can test MCP actions using the `@modelcontextprotocol/sdk` client:

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const transport = new StreamableHTTPClientTransport(
  new URL("http://localhost:8080/mcp"),
  {
    requestInit: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  },
);

const client = new Client({ name: "test-client", version: "1.0.0" });
await client.connect(transport);

const tools = await client.listTools();
const result = await client.callTool({
  name: "status",
  arguments: {},
});
```
