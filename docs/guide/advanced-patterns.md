---
description: Production patterns for RBAC, audit logging, and middleware composition in Keryx apps.
---

# Advanced Patterns

This guide shows how to compose Keryx primitives — [middleware](/guide/middleware), [actions](/guide/actions), and `connection.metadata` — into patterns you'll reach for in most production apps. The examples use a simple "team" domain, but the techniques apply to any multi-tenant or role-based application.

## Middleware Factories

The [middleware guide](/guide/middleware) shows static `ActionMiddleware` objects. But what if different actions need different permission levels? Instead of writing separate middleware for each role, write a function that takes a role and _returns_ a middleware:

```ts
function RequireRole(role: string): ActionMiddleware {
  return {
    runBefore: async (params, connection) => {
      // check the role, throw if insufficient
    },
  };
}
```

Now you can parameterize per-action: `middleware = [SessionMiddleware, RequireRole("admin")]`. The most common use of this pattern is role-based access control.

## Role-Based Access Control

### Roles and Hierarchy

Start by defining your roles and a way to compare them:

```ts
// roles.ts
export const Roles = ["viewer", "editor", "admin"] as const;
export type Role = (typeof Roles)[number];

const ROLE_LEVEL: Record<Role, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
};

/** Returns true if the user's role meets or exceeds the required role. */
export function meetsRole(userRole: Role, required: Role): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[required];
}
```

### RBAC Middleware Factory

The middleware factory looks up the user's membership from the database, checks their role against the requirement, and stores the membership on `connection.metadata` for the action to use:

```ts
// rbac-middleware.ts
import {
  api,
  ErrorType,
  TypedError,
  type ActionMiddleware,
  type Connection,
} from "keryx";
import { eq, and } from "drizzle-orm";
import { meetsRole, type Role } from "./roles";
import { teamMembers } from "./schema";
import type { AppConnectionMeta } from "./types";

export function RbacMiddleware(requiredRole: Role): ActionMiddleware {
  return {
    runBefore: async (
      params: Record<string, unknown>,
      connection: Connection<any, AppConnectionMeta>,
    ) => {
      const userId = connection.session!.data.userId;
      const teamId = params.teamId as number;

      if (!teamId) {
        throw new TypedError({
          message: "teamId is required",
          type: ErrorType.ACTION_VALIDATION,
        });
      }

      try {
        const [membership] = await api.db.db
          .select()
          .from(teamMembers)
          .where(
            and(eq(teamMembers.userId, userId), eq(teamMembers.teamId, teamId)),
          );

        if (!membership || !meetsRole(membership.role as Role, requiredRole)) {
          throw new TypedError({
            message: "Insufficient permissions",
            type: ErrorType.CONNECTION_CHANNEL_AUTHORIZATION,
          });
        }

        // Make the membership available to the action
        connection.metadata.membership = membership;
      } catch (e) {
        if (e instanceof TypedError) throw e;
        throw new TypedError({
          message: "An unexpected error occurred",
          type: ErrorType.CONNECTION_ACTION_RUN,
        });
      }
    },
  };
}
```

Use it on any action:

```ts
export class TeamEdit implements Action {
  name = "team:edit";
  middleware = [SessionMiddleware, RbacMiddleware("admin")];
  // ...

  async run(
    params: ActionParams<TeamEdit>,
    connection: Connection<any, AppConnectionMeta>,
  ) {
    const membership = connection.metadata.membership!; // set by RbacMiddleware
    // ...
  }
}
```

### Multiple Role Domains

Some apps have separate role hierarchies — for example, organization-level roles (owner, admin, member) and project-level roles (manager, editor, viewer) with no implicit access between them. In that case, create separate middleware factories for each domain:

```ts
middleware = [SessionMiddleware, OrgRbacMiddleware("admin")]; // control plane
middleware = [SessionMiddleware, ProjectRbacMiddleware("editor")]; // data plane
```

If an action should be accessible from _either_ domain (e.g. a project admin _or_ an org admin can manage project members), build a combined middleware that checks both and authorizes if either passes.

### Runtime Introspection

You can attach metadata to middleware objects for runtime inspection — useful for building permissions endpoints or auto-generating documentation. One approach is to use a well-known Symbol:

```ts
export const RBAC_DESCRIPTOR = Symbol.for("app.rbac");

export function RbacMiddleware(requiredRole: Role): ActionMiddleware {
  const mw: ActionMiddleware & { [RBAC_DESCRIPTOR]?: { role: Role } } = {
    runBefore: async (params, connection) => {
      /* ... */
    },
  };
  mw[RBAC_DESCRIPTOR] = { role: requiredRole };
  return mw;
}
```

An endpoint can then iterate over an action's `middleware` array, check for the Symbol, and expose the role requirements to the frontend or to AI agents.

## Audit Logging with Base Action Classes

When many actions share the same cross-cutting concern — wrapping database writes in a transaction and inserting an audit log — you can extract that into an abstract base class.

### The Base Class

```ts
// audited-action.ts
import {
  api,
  ErrorType,
  TypedError,
  type Action,
  type ActionMiddleware,
  type Connection,
} from "keryx";
import { z } from "zod";
import { auditLogs } from "./schema";
import type { AppConnectionMeta } from "./types";

export abstract class AuditedAction implements Action {
  abstract name: string;
  abstract description: string;
  abstract inputs: z.ZodType<any>;
  abstract middleware: ActionMiddleware[];
  abstract web: { route: string; method: any };

  /** Subclasses implement this instead of run(). Use tx for all DB queries. */
  abstract runWithAudit(
    tx: any,
    params: Record<string, unknown>,
    connection: Connection<any, AppConnectionMeta>,
  ): Promise<any>;

  async run(
    params: Record<string, unknown>,
    connection: Connection<any, AppConnectionMeta>,
  ) {
    try {
      return await api.db.db.transaction(async (tx) => {
        const result = await this.runWithAudit(tx, params, connection);

        // Insert audit log in the same transaction — atomic with the data change
        await tx.insert(auditLogs).values({
          userId: connection.session?.data.userId ?? null,
          action: this.name,
          metadata: params,
          before: connection.metadata.auditBefore ?? null,
          after: connection.metadata.auditAfter ?? null,
        });

        return result;
      });
    } catch (e) {
      if (e instanceof TypedError) throw e;
      throw new TypedError({
        message: "An unexpected error occurred",
        type: ErrorType.CONNECTION_ACTION_RUN,
      });
    }
  }
}
```

The key detail: the audit log insert runs _inside_ the same database transaction as the action's writes. If either the action or the audit insert fails, both roll back — you never get orphaned audit entries or missing logs for successful operations.

### Using It

Subclasses implement `runWithAudit()` and set before/after snapshots on `connection.metadata`:

```ts
export class TeamEdit extends AuditedAction {
  name = "team:edit";
  description = "Edit a team's settings";
  inputs = z.object({
    teamId: z.coerce.number(),
    name: z.string().min(1).optional(),
  });
  middleware = [SessionMiddleware, RbacMiddleware("admin")];
  web = { route: "/team", method: HTTP_METHOD.PUT };

  async runWithAudit(tx, params: ActionParams<TeamEdit>, connection) {
    // Capture the before state
    const [before] = await tx
      .select()
      .from(teams)
      .where(eq(teams.id, params.teamId));
    connection.metadata.auditBefore = before;

    // Make the change
    const [after] = await tx
      .update(teams)
      .set({ name: params.name })
      .where(eq(teams.id, params.teamId))
      .returning();
    connection.metadata.auditAfter = after;

    return { team: after };
  }
}
```

The action only thinks about business logic. The base class handles the transaction wrapper, audit logging, and error handling.

## Putting It Together

Here's the full request flow when these patterns are combined:

1. **SessionMiddleware** — verifies the user is authenticated
2. **RbacMiddleware("admin")** — looks up team membership, checks role, stores membership on `connection.metadata`
3. **AuditedAction.run()** — opens a database transaction
4. **runWithAudit()** — captures before state, makes the change, captures after state
5. **Audit log insert** — writes the log entry in the same transaction
6. **Transaction commits** — data change and audit log are atomically persisted

If any step throws, everything after it is skipped — middleware short-circuits the action, and the transaction rolls back both the data change and the audit entry.
