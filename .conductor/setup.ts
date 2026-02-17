#!/usr/bin/env bun
/**
 * Conductor workspace setup script.
 * Reads .env.example files and overrides only the variables that need
 * workspace-specific values (ports, Redis DBs, Postgres DBs) based on
 * CONDUCTOR_PORT to allow parallel worktree development.
 *
 * Usage: bun .conductor/setup.ts
 */

import { $ } from "bun";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { getWorkspaceOffset } from "./lib";

const rootDir = join(import.meta.dirname, "..");
const conductorPort = Bun.env.CONDUCTOR_PORT
  ? parseInt(Bun.env.CONDUCTOR_PORT)
  : undefined;

let backendPort: number;
let frontendPort: number;
let redisDb: number;
let redisDbTest: number;
let dbName: string;
let dbNameTest: string;

if (!conductorPort) {
  console.log(
    "CONDUCTOR_PORT is not set. Using defaults (port 8080, Redis DB 0, keryx DB).",
  );
  backendPort = 8080;
  frontendPort = 3000;
  redisDb = 0;
  redisDbTest = 1;
  dbName = "keryx";
  dbNameTest = "keryx-test";
} else {
  console.log(`CONDUCTOR_PORT=${conductorPort}`);

  const offset = getWorkspaceOffset(conductorPort);

  // Backend: 8080+N, Frontend: 3000+N
  backendPort = 8080 + offset;
  frontendPort = 3000 + offset;
  redisDb = (offset * 2) % 16;
  redisDbTest = (offset * 2 + 1) % 16;

  // Postgres DBs: keryx_N and keryx_N_test
  dbName = `keryx_${offset}`;
  dbNameTest = `keryx_${offset}_test`;
}

console.log(`Backend port:    ${backendPort}`);
console.log(`Frontend port:   ${frontendPort}`);
console.log(`Redis DB:        ${redisDb} (test: ${redisDbTest})`);
console.log(`Postgres DB:     ${dbName} (test: ${dbNameTest})`);

// Ensure Postgres is running via Homebrew
try {
  await $`pg_isready -q`.quiet();
  console.log("Postgres is running.");
} catch {
  console.log("Postgres is not running. Starting via Homebrew...");
  try {
    await $`brew services start postgresql@17`.quiet();
    // Wait for Postgres to be ready
    for (let i = 0; i < 10; i++) {
      try {
        await $`pg_isready -q`.quiet();
        break;
      } catch {
        await Bun.sleep(500);
      }
    }
    console.log("Postgres started.");
  } catch {
    console.log("WARNING: Could not start Postgres. Start it manually:");
    console.log("  brew services start postgresql@17");
  }
}

// Create Postgres databases if they don't exist
for (const db of [dbName, dbNameTest]) {
  try {
    const result = await $`psql -lqt`.quiet();
    const databases = result.text();
    if (databases.split("\n").some((line) => line.split("|")[0]?.trim() === db)) {
      console.log(`Database '${db}' already exists.`);
    } else {
      console.log(`Creating database '${db}'...`);
      try {
        await $`createdb ${db}`.quiet();
        console.log(`Created database '${db}'.`);
      } catch {
        console.log(`WARNING: Could not create database '${db}'. Create it manually:`);
        console.log(`  createdb ${db}`);
      }
    }
  } catch {
    console.log(`WARNING: Could not check/create database '${db}'. Create it manually:`);
    console.log(`  createdb ${db}`);
  }
}

/**
 * Read a .env.example file, apply overrides, and write to .env.
 * - Lines with overridden keys get their values replaced
 * - Commented-out lines (# KEY=val) for overridden keys get uncommented and replaced
 * - Any override keys not found in the example are appended at the end
 */
function applyEnvOverrides(
  exampleContent: string,
  overrides: Record<string, string>,
): string {
  const remaining = new Set(Object.keys(overrides));
  const lines = exampleContent.split("\n").map((line) => {
    // Match "KEY=value" or "# KEY=value" (commented-out)
    const match = line.match(/^(#\s*)?([A-Z_][A-Z0-9_]*)=/);
    if (match) {
      const key = match[2];
      if (key in overrides) {
        remaining.delete(key);
        return `${key}=${overrides[key]}`;
      }
    }
    return line;
  });

  // Append any overrides that weren't found in the example
  for (const key of remaining) {
    lines.push(`${key}=${overrides[key]}`);
  }

  return lines.join("\n");
}

// Shared backend overrides for both packages/keryx and example/backend
const user = Bun.env.USER ?? "postgres";
const backendOverrides: Record<string, string> = {
  WEB_SERVER_PORT: String(backendPort),
  APPLICATION_URL: `"http://localhost:${backendPort}"`,
  WEB_SERVER_ALLOWED_ORIGINS: `"http://localhost:${frontendPort},http://localhost:3000"`,
  DATABASE_URL: `"postgres://${user}@localhost:5432/${dbName}"`,
  DATABASE_URL_TEST: `"postgres://${user}@localhost:5432/${dbNameTest}"`,
  REDIS_URL: `"redis://localhost:6379/${redisDb}"`,
  REDIS_URL_TEST: `"redis://localhost:6379/${redisDbTest}"`,
};

// Write packages/keryx/.env (framework package)
const packageExample = await readFile(
  join(rootDir, "packages", "keryx", ".env.example"),
  "utf-8",
);
await writeFile(
  join(rootDir, "packages", "keryx", ".env"),
  applyEnvOverrides(packageExample, backendOverrides),
);
console.log("Wrote packages/keryx/.env");

// Write example/backend/.env
const exampleBackendExample = await readFile(
  join(rootDir, "example", "backend", ".env.example"),
  "utf-8",
);
await writeFile(
  join(rootDir, "example", "backend", ".env"),
  applyEnvOverrides(exampleBackendExample, backendOverrides),
);
console.log("Wrote example/backend/.env");

// Write example/frontend/.env
const frontendOverrides: Record<string, string> = {
  NEXT_PUBLIC_API_URL: `http://localhost:${backendPort}`,
  PORT: String(frontendPort),
};

const frontendExample = await readFile(
  join(rootDir, "example", "frontend", ".env.example"),
  "utf-8",
);
await writeFile(
  join(rootDir, "example", "frontend", ".env"),
  applyEnvOverrides(frontendExample, frontendOverrides),
);
console.log("Wrote example/frontend/.env");

console.log("\nSetup complete! Run 'bun dev' to start both servers.");
