# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

bun-actionhero is a modern ActionHero framework rewrite that combines the best ideas from Rails and Node.js while leveraging Bun's performance. It's a monorepo with separate backend and frontend applications designed around transport-agnostic actions that can be called via HTTP, WebSockets, CLI, or as background tasks.

## Essential Commands

### Development & Testing
```bash
# Root level
bun dev              # Run both backend and frontend with hot reload
bun tests           # Run all tests (note: plural "tests")
bun test-backend    # Backend tests only
bun test-frontend   # Frontend tests only
bun ci              # Full CI: lint, compile, test

# Backend specific
cd backend && bun dev                   # Backend development server
cd backend && bun migrations           # Generate database migrations
cd backend && ./actionhero.ts start   # Start production server
cd backend && ./actionhero.ts "action:name" # Run CLI actions

# Frontend specific
cd frontend && bun dev     # Next.js development server
cd frontend && bun types   # Generate TypeScript types from backend
```

### Code Quality
```bash
bun lint     # Lint all code
bun format   # Format all code with Prettier
bun compile  # Build both applications
```

## Core Architecture

### Action Pattern
Actions are the central abstraction - transport-agnostic functions that work across HTTP, WebSocket, CLI, and background tasks:

```typescript
export class MyAction implements Action {
  name = "my:action";
  web = { route: "/my-endpoint", method: HTTP_METHOD.POST }; // HTTP transport
  task = { queue: "default", frequency: 3600000 }; // Background task (optional)
  inputs = { /* input validation schema */ };
  middleware = [SessionMiddleware]; // Optional middleware
  
  async run(params: ActionParams<MyAction>, connection: Connection) {
    // Transport-agnostic implementation
  }
}
```

### Database & Schema Management
- **ORM**: Drizzle ORM with PostgreSQL
- **Schema Location**: `backend/schema/` directory
- **Migration Workflow**: Modify schema → `bun migrations` → restart server (auto-applies)
- **Types**: Auto-inferred from schema definitions

### Frontend Integration
- **Type Generation**: Frontend pulls backend types via `bun types`
- **API Client**: `frontend/utils/client.ts` with automatic credential handling
- **Full Type Safety**: Backend actions generate TypeScript types for frontend

## Directory Structure

### Backend (`/backend/`)
- `actions/` - Transport-agnostic action controllers
- `classes/` - Core framework classes (API, Action, Connection, etc.)
- `config/` - Environment configuration
- `initializers/` - Startup sequence components
- `middleware/` - Cross-cutting concerns (auth, validation)
- `schema/` - Drizzle ORM database schemas
- `ops/` - Business logic operations
- `servers/` - Transport implementations

### Frontend (`/frontend/`)
- Standard Next.js application structure
- `utils/client.ts` - Typed API client
- `types/backend/` - Auto-generated backend types

## Testing Guidelines

- **Location**: Run tests from respective directories (`backend/`, `frontend/`)
- **HTTP Tests**: Include proper request bodies and Content-Type headers
- **Authentication**: Include session cookies for protected endpoints
- **Cleanup**: Use `afterAll` blocks to clean test data
- **Coverage**: Test both success and error cases

## Environment Setup

- **Local Development**: Requires PostgreSQL + Redis
- **Environment Variables**: Separate `.env` files for backend/frontend
- **Database**: Auto-migration controlled by `DATABASE_AUTO_MIGRATE` flag
- **Development Database**: Uses `bun-test` database for testing

## Key Implementation Notes

- **Input Validation**: All action inputs must be validated with proper schemas
- **Error Handling**: Use `TypedError` class for structured error responses  
- **Session Management**: Redis-based sessions with `SessionMiddleware`
- **Type Safety**: Strong TypeScript integration throughout the stack
- **Transport Agnostic**: Same action code works for web, CLI, WebSocket, and background tasks