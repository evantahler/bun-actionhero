---
description: CLI commands for scaffolding projects, generating components, and running your Keryx server.
---

# CLI

Keryx includes a CLI (`keryx`) for common project tasks. When installed locally, run it with `bunx keryx`. When scaffolding a brand-new project, use `bunx keryx@latest`.

## `keryx new`

Scaffold a new Keryx project. See [Getting Started](/guide/) for the full walkthrough.

```bash
bunx keryx new my-app
```

Options:

- `--no-interactive` / `-y` — skip prompts, use defaults
- `--no-db` — skip database setup files
- `--no-example` — skip the example action

## `keryx generate`

Generate a new component file with boilerplate. Aliased as `keryx g`.

```bash
bunx keryx generate <type> <name>
```

### Supported Types

| Type          | Directory       | Example                         |
| ------------- | --------------- | ------------------------------- |
| `action`      | `actions/`      | `keryx g action user:delete`    |
| `initializer` | `initializers/` | `keryx g initializer cache`     |
| `middleware`  | `middleware/`   | `keryx g middleware auth`       |
| `channel`     | `channels/`     | `keryx g channel notifications` |
| `ops`         | `ops/`          | `keryx g ops UserOps`           |

### Naming Conventions

Colon-separated names create nested directories and map to routes for actions:

```bash
keryx g action user:delete
# Creates: actions/user/delete.ts
# Route:   /api/user/delete
# Class:   UserDelete
```

Simple names stay flat:

```bash
keryx g initializer cache
# Creates: initializers/cache.ts
# Class:   Cache
```

### Options

- `--dry-run` — preview what would be generated without writing files
- `--force` — overwrite existing files
- `--no-test` — skip generating the companion test file

By default, each generated component also creates a matching test file in `__tests__/`.

### Example Output

```bash
$ bunx keryx g action user:delete

Generated:
  actions/user/delete.ts
  __tests__/actions/user/delete.test.ts
```

The generated action file:

```ts
import { z } from "zod";
import { Action, type ActionParams } from "keryx";
import { HTTP_METHOD } from "keryx/classes/Action.ts";

export class UserDelete implements Action {
  name = "user:delete";
  description = "TODO: describe this action";
  inputs = z.object({});
  web = { route: "/api/user/delete", method: HTTP_METHOD.GET };

  async run(params: ActionParams<UserDelete>) {
    // TODO: implement
    return {};
  }
}
```

## `keryx upgrade`

Update framework-owned files (like `keryx.ts`) to match the installed version of Keryx.

```bash
bunx keryx upgrade
```

Options:

- `--dry-run` — show what would change without writing
- `--force` / `-y` — overwrite all framework files without confirmation

## `keryx start`

Start the server.

```bash
bunx keryx start
```

## `keryx actions`

List all discovered actions with their routes and descriptions.

```bash
bunx keryx actions
```

## Action CLI Commands

Every action in your project is also available as a CLI command. Keryx auto-discovers actions and registers them with the CLI, so you can invoke any action directly:

```bash
bunx keryx <action-name> [--input value]
```

For example, if you have a `status` action:

```bash
bunx keryx status
```

Action inputs are passed as CLI flags matching the input schema field names.
