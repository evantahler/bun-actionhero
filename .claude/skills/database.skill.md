---
name: database
description: Database operations, migrations, and management
when_to_use: |
  - User needs to set up or configure the database
  - User asks about database migrations
  - User wants to backup or restore data
  - User mentions Drizzle ORM or database operations
  - User is modifying database schemas
keywords: [database, postgres, migration, drizzle, backup, restore, schema]
---

# Database Management

Database operations and management for the Keryx project.

## Setup

### Create Databases
```bash
createdb bun          # Development database
createdb bun-test     # Test database
```

### Environment Setup
- Copy `.env.example` to `.env`
- Configure database connection in `.env`

## Migrations

### Create Migrations
```bash
bun run migrations.ts
```

### Auto-Apply Migrations
- Migrations are automatically applied on server start
- Check server logs for migration status

## Drizzle ORM

### Schema Location
- Schemas are in `backend/schema/`
- Each model has its own schema file

### Query Builder
- Use Drizzle's query builder for database operations
- Type-safe queries with TypeScript

## Common Operations

### Backup Database
```bash
pg_dump bun > backup.sql
```

### Restore Database
```bash
psql bun < backup.sql
```

## Best Practices
- Always use migrations for schema changes
- Test database operations in test environment
- Use transactions for multiple operations
- Clean up test data after tests
