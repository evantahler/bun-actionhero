#!/usr/bin/env bun
/**
 * Conductor workspace setup script.
 * Generates .env files with unique ports, Redis DBs, and Postgres DBs
 * based on CONDUCTOR_PORT to allow parallel worktree development.
 *
 * Usage: bun .conductor/setup.ts
 */

import { $ } from "bun";
import { writeFile } from "fs/promises";
import { join } from "path";

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

  // Workspace offset from CONDUCTOR_PORT range
  const offset = Math.floor((conductorPort - 55000) / 10);

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

// Write backend/.env
const user = Bun.env.USER ?? "postgres";
const backendEnv = `PROCESS_NAME=actionhero-server
PROCESS_NAME_TEST=test-server
PROCESS_SHUTDOWN_TIMEOUT=30000

LOG_LEVEL=info
LOG_LEVEL_TEST=fatal
LOG_INCLUDE_TIMESTAMPS=false
LOG_COLORIZE=true

WEB_SERVER_ENABLED=true
WEB_SERVER_PORT=${backendPort}
WEB_SERVER_PORT_TEST=0
WEB_SERVER_HOST=localhost
WEB_SERVER_API_ROUTE="/api"
WEB_SERVER_ALLOWED_ORIGINS="http://localhost:${frontendPort}"
WEB_SERVER_ALLOWED_METHODS="GET, POST, PUT, DELETE, OPTIONS"

MCP_SERVER_ENABLED=true

SESSION_TTL=86400000
SESSION_COOKIE_NAME="__session"

DATABASE_URL="postgres://${user}@localhost:5432/${dbName}"
DATABASE_URL_TEST="postgres://${user}@localhost:5432/${dbNameTest}"
DATABASE_AUTO_MIGRATE=true

REDIS_URL="redis://localhost:6379/${redisDb}"
REDIS_URL_TEST="redis://localhost:6379/${redisDbTest}"

RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_UNAUTH_LIMIT=20
RATE_LIMIT_AUTH_LIMIT=200

TASKS_ENABLED=true
TASK_PROCESSORS=1
TASK_TIMEOUT=5000
TASK_TIMEOUT_TEST=100
`;

await writeFile(join(rootDir, "backend", ".env"), backendEnv);
console.log("Wrote backend/.env");

// Write frontend/.env
const frontendEnv = `NEXT_PUBLIC_API_URL=http://localhost:${backendPort}
PORT=${frontendPort}
`;

await writeFile(join(rootDir, "frontend", ".env"), frontendEnv);
console.log("Wrote frontend/.env");

console.log("\nSetup complete! Run 'bun dev' to start both servers.");
