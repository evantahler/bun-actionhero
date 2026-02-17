import fs from "fs";
import path from "path";
import * as readline from "readline";
import pkg from "../package.json";

export interface ScaffoldOptions {
  includeDb: boolean;
  includeExample: boolean;
}

async function prompt(question: string, defaultValue: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${question} `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function promptYesNo(
  question: string,
  defaultYes: boolean,
): Promise<boolean> {
  const hint = defaultYes ? "Y/n" : "y/N";
  const answer = await prompt(`${question} (${hint})`, defaultYes ? "y" : "n");
  return answer.toLowerCase().startsWith("y");
}

export async function interactiveScaffold(
  projectName?: string,
): Promise<{ projectName: string; options: ScaffoldOptions }> {
  if (!projectName) {
    projectName = await prompt("Project name:", "my-keryx-app");
  }

  const includeDb = await promptYesNo("Include database setup?", true);
  const includeExample = await promptYesNo("Include example action?", true);

  return { projectName, options: { includeDb, includeExample } };
}

export async function scaffoldProject(
  projectName: string,
  targetDir: string,
  options: ScaffoldOptions,
): Promise<string[]> {
  const keryxVersion = pkg.version;
  const createdFiles: string[] = [];

  if (fs.existsSync(targetDir)) {
    throw new Error(`Directory "${projectName}" already exists`);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  const write = async (filePath: string, content: string) => {
    const fullPath = path.join(targetDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    await Bun.write(fullPath, content);
    createdFiles.push(filePath);
  };

  // --- Always generated ---

  await write(
    "package.json",
    JSON.stringify(
      {
        name: projectName,
        version: "0.0.1",
        module: "index.ts",
        type: "module",
        private: true,
        license: "MIT",
        bin: { keryx: "keryx.ts" },
        scripts: {
          start: "bun keryx.ts start",
          dev: "bun --watch keryx.ts start",
          ...(options.includeDb ? { migrations: "bun run migrations.ts" } : {}),
          lint: "tsc && prettier --check .",
          format: "tsc && prettier --write .",
        },
        dependencies: {
          keryx: `^${keryxVersion}`,
          ...(options.includeDb ? { "drizzle-zod": "^0.8.3" } : {}),
        },
        devDependencies: {
          "@types/bun": "latest",
          prettier: "^3.8.1",
          ...(options.includeDb ? { "drizzle-kit": "^0.20.18" } : {}),
        },
      },
      null,
      2,
    ) + "\n",
  );

  await write(
    "index.ts",
    `import { api } from "keryx";

// Point the API to this project's directory for loading user actions/initializers/channels
api.rootDir = import.meta.dir;

// Re-export everything from keryx for convenience
export * from "keryx";
`,
  );

  await write(
    "keryx.ts",
    `#! /usr/bin/env bun

// Set rootDir before any framework code loads actions
import { api } from "./index";

import { Command } from "commander";
import { Action, globLoader } from "keryx";
import { addActionToProgram } from "keryx/util/cli.ts";
import path from "path";
import pkg from "./package.json";

const program = new Command();
program.name(pkg.name).description(pkg.description).version(pkg.version);

program
  .command("start")
  .summary("Run the server")
  .description("Start the Keryx server")
  .action(async () => {
    await api.start();
  });

// Load framework actions from the package directory
const frameworkActions = await globLoader<Action>(
  path.join(api.packageDir, "actions"),
);

// Load user project actions
let userActions: Action[] = [];
try {
  userActions = await globLoader<Action>(path.join(api.rootDir, "actions"));
} catch {
  // user project may not have actions, that's fine
}

const actions = [...frameworkActions, ...userActions];
actions.forEach((action) => addActionToProgram(program, action));

program
  .command("actions")
  .summary("List all actions")
  .action(async () => {
    const actionSpacing =
      actions.map((a) => a.name.length).reduce((a, b) => Math.max(a, b), 0) +
      2;
    const routeSpacing =
      actions
        .map((a) =>
          a.web ? a.web.route.toString().length + a.web.method.length : 0,
        )
        .reduce((a, b) => Math.max(a, b), 0) + 2;

    actions
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((action) => {
        console.log(
          \`\${action.name}\${" ".repeat(actionSpacing - action.name.length)} \${action.web ? \`[\${action.web.method}] \${action.web.route}\` : " "}\${" ".repeat(routeSpacing - (action.web ? action.web.method.length + action.web.route.toString().length + 2 : 0))} \${action.description ?? ""}\`,
        );
      });
  });

program.parse();
`,
  );

  await write(
    "tsconfig.json",
    JSON.stringify(
      {
        compilerOptions: {
          lib: ["ESNext"],
          target: "ESNext",
          module: "ESNext",
          moduleResolution: "bundler",
          types: ["bun-types"],
          strict: true,
          skipLibCheck: true,
          noEmit: true,
          esModuleInterop: true,
          resolveJsonModule: true,
          isolatedModules: true,
          verbatimModuleSyntax: true,
          noImplicitAny: true,
          noImplicitReturns: true,
          noUnusedLocals: true,
          noUnusedParameters: true,
          noFallthroughCasesInSwitch: true,
          forceConsistentCasingInFileNames: true,
          allowImportingTsExtensions: true,
        },
        include: ["**/*.ts"],
        exclude: ["node_modules", "drizzle"],
      },
      null,
      2,
    ) + "\n",
  );

  await write(
    ".env.example",
    `PROCESS_NAME=${projectName}
PROCESS_NAME_TEST=test-server
PROCESS_SHUTDOWN_TIMEOUT=30000

LOG_LEVEL=info
LOG_LEVEL_TEST=fatal
LOG_INCLUDE_TIMESTAMPS=false
LOG_COLORIZE=true

WEB_SERVER_ENABLED=true
WEB_SERVER_PORT=8080
WEB_SERVER_PORT_TEST=0
WEB_SERVER_HOST=localhost
WEB_SERVER_API_ROUTE="/api"
WEB_SERVER_ALLOWED_ORIGINS="http://localhost:3000"
WEB_SERVER_ALLOWED_METHODS="GET, POST, PUT, DELETE, OPTIONS"

MCP_SERVER_ENABLED=true

SESSION_TTL=86400000
SESSION_COOKIE_NAME="__session"

DATABASE_URL="postgres://$USER@localhost:5432/${projectName}"
DATABASE_URL_TEST="postgres://$USER@localhost:5432/${projectName}-test"
DATABASE_AUTO_MIGRATE=true

REDIS_URL="redis://localhost:6379/0"
REDIS_URL_TEST="redis://localhost:6379/1"

RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_UNAUTH_LIMIT=20
RATE_LIMIT_AUTH_LIMIT=200

TASKS_ENABLED=true
TASK_PROCESSORS=1
TASK_TIMEOUT=5000
TASK_TIMEOUT_TEST=100
`,
  );

  await write(
    ".gitignore",
    `node_modules/
.env
drizzle/
`,
  );

  // Create empty directories with .gitkeep
  await write("initializers/.gitkeep", "");

  // --- Database setup ---

  if (options.includeDb) {
    await write(
      "migrations.ts",
      `// Set rootDir before any framework code loads
import "./index";

import { api } from "keryx";

await api.initialize();
await api.db.generateMigrations();
process.exit(0);
`,
    );

    await write("schema/.gitkeep", "");
  }

  // --- Example action ---

  if (options.includeExample) {
    await write(
      "actions/hello.ts",
      `import { z } from "zod";
import { Action, type ActionParams } from "keryx";
import { HTTP_METHOD } from "keryx/classes/Action.ts";

export class Hello implements Action {
  name = "hello";
  description = "Say hello";
  inputs = z.object({
    name: z.string().default("World"),
  });
  web = { route: "/hello", method: HTTP_METHOD.GET };

  async run(params: ActionParams<Hello>) {
    return { message: \`Hello, \${params.name}!\` };
  }
}
`,
    );
  } else {
    await write("actions/.gitkeep", "");
  }

  return createdFiles;
}
