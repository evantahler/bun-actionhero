---
name: database-and-schema
description: Database setup, Drizzle ORM schemas, migrations, and the Ops business logic layer
when_to_use: |
  - User is working with database schemas or migrations
  - User asks about Drizzle ORM or database operations
  - User is modifying or creating Ops (business logic layer)
  - User needs to set up or configure PostgreSQL
keywords: [database, postgres, migration, drizzle, schema, ops, sql, backup, restore]
---

# Database & Schema

## Database Names

- Development: `keryx`
- Test: `keryx-test`

Both require PostgreSQL running locally. Defaults assume Homebrew Postgres with `$USER` as superuser (no password).

## Schema Location

Drizzle ORM table definitions live in `example/backend/schema/`. Each model has its own file.

## Migrations

```bash
cd example/backend
bun run migrations    # Generate migration SQL from schema changes
```

Migration SQL files are stored in `example/backend/drizzle/`. Migrations auto-apply on server start when `config.database.autoMigrate` is true.

## Ops Pattern

Business logic is separated from actions into Ops files in `example/backend/ops/` (e.g., `UserOps`, `MessageOps`). Actions call Ops; Ops handle DB queries and business rules.

## Zod Model Helpers

- **Framework** (`packages/keryx/util/zodMixins.ts`): `zIdOrModel()` — generic factory for ID-or-model input validation
- **App** (`example/backend/util/zodMixins.ts`): `zUserIdOrModel()`, `zMessageIdOrModel()` — imports `zIdOrModel` from `"keryx"`
