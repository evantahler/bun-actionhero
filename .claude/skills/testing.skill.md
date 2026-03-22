---
name: testing
description: Test patterns, helpers, and structure for Bun test runner with real HTTP requests
when_to_use: |
  - User is writing or debugging tests
  - User asks about test structure or helpers
  - User wants to run tests or understand test failures
keywords: [test, bun test, beforeAll, afterAll, fetch, HTTP, serverUrl, HOOK_TIMEOUT]
---

# Testing Patterns

For full details, see `docs/guide/testing.md`.

## Test File Structure

Each test file boots and stops the full server:

```typescript
import "../index"; // Sets api.rootDir
import { api } from "keryx";
import { HOOK_TIMEOUT, serverUrl } from "./../setup";

beforeAll(async () => { await api.start(); }, HOOK_TIMEOUT);
afterAll(async () => { await api.stop(); }, HOOK_TIMEOUT);

test("...", async () => {
  const res = await fetch(serverUrl() + "/api/status");
  const body = (await res.json()) as ActionResponse<Status>;
});
```

## Key Helpers

- `serverUrl()` — returns the base URL with dynamic port
- `HOOK_TIMEOUT` — timeout for beforeAll/afterAll hooks

## Conventions

- **Real HTTP requests** via `fetch` — no mock server
- **Non-concurrent execution** — tests run sequentially to avoid port conflicts
- **Every code change needs tests** — if a PR has no test changes, that's a red flag

## Auto-Discovery

Actions, initializers, and servers are auto-discovered via `globLoader` (`packages/keryx/util/glob.ts`). It scans for `*.ts` files and instantiates all exported classes. Files prefixed with `.` are skipped.

## Running Tests

```bash
cd packages/keryx && bun test                          # Framework tests
cd example/backend && bun test                          # All example tests
cd example/backend && bun test __tests__/actions/user.test.ts  # Single file
```
