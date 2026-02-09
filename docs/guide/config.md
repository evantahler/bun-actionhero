---
description: Modular configuration with per-environment overrides via environment variables.
---

# Configuration

Config in bun-actionhero is statically defined at boot — there's no dynamic config reloading. That said, every config value supports per-environment overrides via environment variables, so you can set things differently in test, development, and production without touching code.

## Structure

Config is split into modules:

```
backend/config/
├── index.ts        # Aggregates everything into one `config` object
├── database.ts     # Database connection string, auto-migrate flag
├── logger.ts       # Log level, timestamps, colors
├── process.ts      # Process name, shutdown timeout
├── redis.ts        # Redis connection string
├── session.ts      # Session TTL, cookie name
├── tasks.ts        # Task queue settings
└── server/
    ├── web.ts      # Web server port, host, CORS, static files
    └── mcp.ts      # MCP server toggle, route, OAuth TTLs
```

Everything rolls up into a single `config` object:

```ts
import { config } from "../config";

config.database.connectionString; // Postgres URL
config.server.web.port; // 8080
config.logger.level; // "info"
```

## Environment Overrides

The `loadFromEnvIfSet()` helper is where the magic happens:

```ts
import { loadFromEnvIfSet } from "../util/config";

export const configDatabase = {
  connectionString: await loadFromEnvIfSet("DATABASE_URL", "x"),
  autoMigrate: await loadFromEnvIfSet("DATABASE_AUTO_MIGRATE", true),
};
```

The resolution order is:

1. `DATABASE_URL_TEST` (env var with `NODE_ENV` suffix — checked first)
2. `DATABASE_URL` (plain env var)
3. `"x"` (the default value)

This means you can set `DATABASE_URL_TEST=postgres://localhost/bun-test` and it'll automatically be used when `NODE_ENV=test`, without any conditional logic in your config files.

The helper is also type-aware — it parses `"true"`/`"false"` strings into booleans and numeric strings into numbers. So `DATABASE_AUTO_MIGRATE=false` does what you'd expect.

## Reference

### Database

| Key                | Env Var                 | Default |
| ------------------ | ----------------------- | ------- |
| `connectionString` | `DATABASE_URL`          | `"x"`   |
| `autoMigrate`      | `DATABASE_AUTO_MIGRATE` | `true`  |

### Logger

| Key                 | Env Var                  | Default  |
| ------------------- | ------------------------ | -------- |
| `level`             | `LOG_LEVEL`              | `"info"` |
| `includeTimestamps` | `LOG_INCLUDE_TIMESTAMPS` | `true`   |
| `colorize`          | `LOG_COLORIZE`           | `true`   |

### Redis

| Key                | Env Var     | Default                      |
| ------------------ | ----------- | ---------------------------- |
| `connectionString` | `REDIS_URL` | `"redis://localhost:6379/0"` |

### Session

| Key          | Env Var               | Default                  |
| ------------ | --------------------- | ------------------------ |
| `ttl`        | `SESSION_TTL`         | `86400000` (1 day in ms) |
| `cookieName` | `SESSION_COOKIE_NAME` | `"__session"`            |

### Process

| Key               | Env Var                    | Default       |
| ----------------- | -------------------------- | ------------- |
| `name`            | `PROCESS_NAME`             | `"server"`    |
| `shutdownTimeout` | `PROCESS_SHUTDOWN_TIMEOUT` | `30000` (30s) |

### Web Server

| Key                  | Env Var                      | Default                   |
| -------------------- | ---------------------------- | ------------------------- |
| `enabled`            | `WEB_SERVER_ENABLED`         | `true`                    |
| `port`               | `WEB_SERVER_PORT`            | `8080`                    |
| `host`               | `WEB_SERVER_HOST`            | `"localhost"`             |
| `applicationUrl`     | `APPLICATION_URL`            | `"http://localhost:8080"` |
| `apiRoute`           | `WEB_SERVER_API_ROUTE`       | `"/api"`                  |
| `allowedOrigins`     | `WEB_SERVER_ALLOWED_ORIGINS` | `"*"`                     |
| `staticFilesEnabled` | `WEB_SERVER_STATIC_ENABLED`  | `true`                    |

### Tasks

| Key              | Env Var           | Default |
| ---------------- | ----------------- | ------- |
| `enabled`        | `TASKS_ENABLED`   | `true`  |
| `timeout`        | `TASK_TIMEOUT`    | `5000`  |
| `taskProcessors` | `TASK_PROCESSORS` | `1`     |

### MCP Server

| Key              | Env Var                | Default   |
| ---------------- | ---------------------- | --------- |
| `enabled`        | `MCP_SERVER_ENABLED`   | `false`   |
| `route`          | `MCP_SERVER_ROUTE`     | `"/mcp"`  |
| `oauthClientTtl` | `MCP_OAUTH_CLIENT_TTL` | `2592000` |
| `oauthCodeTtl`   | `MCP_OAUTH_CODE_TTL`   | `300`     |
