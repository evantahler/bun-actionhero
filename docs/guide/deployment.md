---
description: Deploying Keryx — Docker, production builds, and running frontend and backend independently.
---

# Deployment

Keryx runs as two separate applications — a backend API server and a frontend Next.js app. This is intentional. You can deploy them together on the same box, or put the frontend on Vercel and the backend on a VPS, or containerize everything with Docker. Each app is independent.

## Production Build

```bash
# compile both applications
bun compile

# set NODE_ENV=production in .env, then start
bun start
```

## Docker

Each app has its own `Dockerfile`, and there's a `docker-compose.yml` to run everything together:

```bash
docker compose up
```

This starts the backend, frontend, PostgreSQL, and Redis. You probably won't use this exact setup in production, but it shows how the pieces fit together and gives you a working reference for your own deployment config.

## Separate Applications

Rather than bundling the frontend into the backend (like the original ActionHero did with plugins), the frontend and backend are separate Bun applications. This means you can:

- Deploy them independently — frontend on Vercel, backend on Railway, whatever works
- Scale them independently — maybe you need more API capacity but the frontend is fine
- Develop them independently — `cd frontend && bun dev` works without the backend

In development, `bun dev` from the root runs both concurrently with hot reload.

## Environment Variables

Set production config through environment variables. The config system (see [Configuration](/guide/config)) handles the rest:

```bash
NODE_ENV=production
DATABASE_URL=postgres://user:pass@host:5432/dbname
REDIS_URL=redis://host:6379/0
APPLICATION_URL=https://api.example.com
WEB_SERVER_PORT=8080
```

## Production Security

Keryx ships with secure defaults, but a few settings need adjustment for production. See the [Security guide](/guide/security) for full details.

```bash
# Cookies — require HTTPS transport
SESSION_COOKIE_SECURE=true

# CORS — restrict to your domain (wildcard blocks credentials)
WEB_SERVER_ALLOWED_ORIGINS=https://yourapp.com

# Rate limiting — enabled by default, tune thresholds as needed
RATE_LIMIT_UNAUTH_LIMIT=20
RATE_LIMIT_AUTH_LIMIT=200

# Error stack traces — auto-disabled when NODE_ENV=production
NODE_ENV=production

# Security headers — defaults are production-ready
# Customize CSP if your backend serves HTML with external resources:
# WEB_SECURITY_CSP="default-src 'self'; script-src 'self' https://cdn.example.com"

# WebSocket limits — adjust for your expected traffic
# WS_MAX_PAYLOAD_SIZE=65536
# WS_MAX_MESSAGES_PER_SECOND=20
```

## Database Migrations

Migrations auto-apply on server start when `DATABASE_AUTO_MIGRATE=true` (the default). If you'd rather run them explicitly before deploying:

```bash
cd backend && bun run migrations
```

This generates migration files from schema changes into `./drizzle/`. They'll be applied automatically the next time the server starts — or you can set `DATABASE_AUTO_MIGRATE=false` and handle it yourself.
