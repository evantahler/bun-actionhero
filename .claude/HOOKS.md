# Claude Code Hooks - Best Practices Enforcement

This document describes the Claude Code hooks configured for the bun-actionhero project to enforce code quality and best practices.

## Overview

These hooks run automatically whenever Claude Code processes a user prompt, ensuring that all code changes meet project standards before being committed.

## Configured Hooks

### UserPromptSubmit Hook

**Trigger**: Runs every time you submit a prompt to Claude Code
**Purpose**: Validates code quality, formatting, and project-specific best practices
**Script**: [.claude/pre-commit-hook.sh](.claude/pre-commit-hook.sh)
**Timeout**: 300 seconds (5 minutes)

## Checks Performed

### 1. Branch Protection

**What it does**: Prevents direct commits to the `main` branch

**Why**: Enforces a feature-branch workflow and ensures all changes go through pull requests

**How to fix**: Create a feature branch before making changes
```bash
git checkout -b feature/your-feature-name
```

---

### 2. Auto-formatting

**What it does**: Automatically formats code using Prettier

**Why**: Ensures consistent code style across the entire codebase

**Formatting applied to**:
- Backend: TypeScript files in `backend/`
- Frontend: TypeScript/React files in `frontend/`

**Configuration**: Uses Prettier with import sorting plugins configured in [backend/.prettierrc](../backend/.prettierrc) and [frontend/.prettierrc](../frontend/.prettierrc)

---

### 3. Console.log Detection

**What it does**: Warns about `console.log` statements in production code

**Why**: The project uses a custom Logger class for structured logging

**Allowed**: `console.log` is permitted in test files (`__tests__/` and `*.test.ts`)

**How to fix**: Replace with the Logger API
```typescript
import { logger } from './api';

// Instead of:
console.log('User created:', userId);

// Use:
logger.info('User created', { userId });
```

---

### 4. Action Validation

**What it does**: Validates Action class definitions for proper structure

**Checks performed**:
- ✅ Actions must define Zod input schema: `inputs = z.object({...})`
- ✅ Sensitive fields (password, secret, token, apiKey) must use `.secret()` mixin
- ⚠️  Warning if middleware is not explicitly declared

**Example of a properly validated Action**:
```typescript
export class UserCreate implements Action {
  name = "user:create";
  description = "Create a new user";

  inputs = z.object({
    email: z.string().email(),
    password: z.string().secret(), // ✓ Uses .secret()
  });

  middleware = [SessionMiddleware]; // ✓ Explicitly declared

  async run(params: ActionParams<UserCreate>) {
    // Implementation
  }
}
```

---

### 5. Test Coverage for New Actions

**What it does**: Ensures every new Action has a corresponding test file

**Why**: Maintains high test coverage and catches issues early

**Expected structure**:
```
backend/actions/userCreate.ts
  → Must have: backend/__tests__/actions/userCreate.test.ts
```

**Test template**:
```typescript
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import "./setup";

beforeAll(async () => {
  await api.start();
  await api.db.clearDatabase();
});

afterAll(async () => {
  await api.stop();
});

describe("user:create", () => {
  test("should create a user", async () => {
    const res = await fetch(url + "/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", password: "pass123" })
    });

    expect(res.status).toBe(200);
  });
});
```

---

### 6. Workspace-Specific Testing

**What it does**: Runs tests only for changed workspaces

**Why**: Provides fast feedback while ensuring relevant tests pass

**Test commands**:
- Backend changes → `bun test-backend`
- Frontend changes → `bun test-frontend`
- Both changed → runs both test suites

**Requirements**:
- Backend tests require Redis and PostgreSQL (uses `bun-test` database)
- Frontend tests are standalone

---

## Bypassing Hooks

In rare cases where you need to bypass hooks (not recommended):

```bash
# For git commits
git commit --no-verify

# For Claude Code hooks
# Currently hooks cannot be easily bypassed - fix the issues instead
```

**Important**: Bypassing hooks may cause CI failures and should only be done in exceptional circumstances.

---

## Troubleshooting

### Hook fails but I don't see the issue

Run the script manually to see full output:
```bash
bash .claude/pre-commit-hook.sh
```

### Tests are failing

Run tests for the specific workspace:
```bash
bun test-backend   # For backend issues
bun test-frontend  # For frontend issues
```

### Formatting issues persist

Manually format the code:
```bash
bun format         # Format all code
bun format-backend # Backend only
bun format-frontend # Frontend only
```

### Branch protection blocking commits

Switch to a feature branch:
```bash
git checkout -b feature/my-feature
```

---

## Hook Configuration

The hooks are configured in [.claude/settings.local.json](.claude/settings.local.json):

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash .claude/pre-commit-hook.sh",
            "statusMessage": "Running pre-commit quality checks",
            "timeout": 300
          }
        ]
      }
    ]
  }
}
```

---

## Modifying Hooks

To modify the hooks behavior:

1. Edit [.claude/pre-commit-hook.sh](.claude/pre-commit-hook.sh)
2. Make sure the script remains executable: `chmod +x .claude/pre-commit-hook.sh`
3. Test changes manually before relying on them

To disable hooks temporarily:

Edit [.claude/settings.local.json](.claude/settings.local.json) and add:
```json
{
  "disableAllHooks": true
}
```

---

## Best Practices

1. **Keep hooks fast**: Slow hooks interrupt workflow. Current hooks optimize by:
   - Only testing changed workspaces
   - Auto-fixing formatting instead of requiring manual fixes
   - Running checks in parallel where possible

2. **Fail fast**: The hook stops at the first critical failure to provide immediate feedback

3. **Clear error messages**: Each check provides actionable guidance on how to fix issues

4. **Enforce at multiple levels**:
   - Local hooks (these Claude Code hooks)
   - CI pipeline (.github/workflows/test.yaml)
   - Code review process

---

## CI Integration

These hooks complement the CI pipeline, not replace it. The CI runs:

1. **Compile job**: Production build validation
2. **Lint job**: Full codebase formatting check
3. **Test-backend job**: Complete backend test suite with services
4. **Test-frontend job**: Complete frontend test suite

Local hooks provide fast feedback; CI provides comprehensive validation.

---

## Questions?

For issues with Claude Code hooks specifically, see the [Claude Code documentation](https://github.com/anthropics/claude-code).

For project-specific questions, refer to the main [README.md](../README.md).
