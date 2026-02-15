---
description: Middleware intercepts action execution for authentication, authorization, logging, and response modification.
---

# Middleware

Middleware lets you run logic before and after an action executes — authentication checks, parameter normalization, response enrichment, logging, that sort of thing. If you've used Express middleware, the concept is similar, but scoped to individual actions rather than applied globally.

## The Basics

Here's the session middleware we use for authenticated endpoints. It's about as simple as middleware gets:

```ts
import type { ActionMiddleware } from "../classes/Action";
import { ErrorType, TypedError } from "../classes/TypedError";

export const SessionMiddleware: ActionMiddleware = {
  runBefore: async (_params, connection) => {
    if (!connection.session || !connection.session.data.userId) {
      throw new TypedError({
        message: "Session not found",
        type: ErrorType.CONNECTION_SESSION_NOT_FOUND,
      });
    }
  },
};
```

If `runBefore` throws, the action's `run()` method is skipped entirely and the error goes back to the client. That's the primary pattern for auth — check the session, throw if it's missing.

## Interface

```ts
type ActionMiddleware = {
  runBefore?: (
    params: ActionParams<Action>,
    connection: Connection,
  ) => Promise<ActionMiddlewareResponse | void>;
  runAfter?: (
    params: ActionParams<Action>,
    connection: Connection,
  ) => Promise<ActionMiddlewareResponse | void>;
};
```

Both methods are optional. You can have middleware that only runs before (auth), only runs after (logging), or both. Middleware can also modify params and responses by returning an `ActionMiddlewareResponse`:

```ts
type ActionMiddlewareResponse = {
  updatedParams?: ActionParams<Action>;
  updatedResponse?: any;
};
```

## Applying Middleware

Add middleware to an action via the `middleware` array:

```ts
export class UserEdit implements Action {
  name = "user:edit";
  middleware = [SessionMiddleware];
  // ...
}
```

Middleware runs in array order. If you have `[AuthMiddleware, RateLimitMiddleware]`, auth runs first — if it throws, rate limiting never executes.

## Common Patterns

### Authentication

This is the most common use case. Check that a session exists and has the data you expect:

```ts
export const SessionMiddleware: ActionMiddleware = {
  runBefore: async (_params, connection) => {
    if (!connection.session?.data.userId) {
      throw new TypedError({
        message: "Session not found",
        type: ErrorType.CONNECTION_SESSION_NOT_FOUND,
      });
    }
  },
};
```

### Param Normalization

You can modify params before the action sees them — useful for things like lowercasing emails:

```ts
export const NormalizeMiddleware: ActionMiddleware = {
  runBefore: async (params) => {
    return {
      updatedParams: {
        ...params,
        email: params.email?.toLowerCase(),
      },
    };
  },
};
```

That said, you can also handle this in the Zod schema with `.transform()` — so use whichever approach makes more sense for your case.

### Rate Limiting

The built-in `RateLimitMiddleware` uses a Redis-backed sliding window to limit request rates per client. It identifies users by user ID (authenticated) or IP address (unauthenticated):

```ts
import { RateLimitMiddleware } from "../middleware/rateLimit";

export class ApiEndpoint implements Action {
  name = "api:endpoint";
  middleware = [SessionMiddleware, RateLimitMiddleware];
  // ...
}
```

When a client exceeds the limit, the middleware throws a `CONNECTION_RATE_LIMITED` error (HTTP 429). Rate limit info is attached to the connection and included in response headers automatically.

See the [Security guide](/guide/security) for configuration options and custom limit overrides.

### Response Enrichment

`runAfter` can add data to the response. This runs after the action's `run()` method completes:

```ts
export const TimingMiddleware: ActionMiddleware = {
  runAfter: async (_params, connection) => {
    return {
      updatedResponse: {
        requestDuration: Date.now() - connection.startTime,
      },
    };
  },
};
```
