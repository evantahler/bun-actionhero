# Backend Rules

Core rules and guidelines for backend development.

## Error Handling

Whenever possible, use the `TypedError` class to throw errors.

## Database Migrations

After any modification of the models, we need to migrate. Never create the migration file yourself. Run `./actionhero.ts migrations` in the backend directory to migrate.

## Development Workflow

Do not try to run the server after making any change - it's probably already running by the developer. Instead, create tests.

## Routing

When creating routes, and there's an id required of the action, use the `/:id` syntax.

## Database Operations

In database operations where we read or write, type the return value of the operation.
