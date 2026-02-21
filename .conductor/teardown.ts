#!/usr/bin/env bun
/**
 * Conductor workspace teardown script.
 * Drops Postgres databases and flushes Redis DBs created by setup.ts.
 *
 * Environment variables provided by Conductor:
 *   CONDUCTOR_WORKSPACE_NAME  - Workspace name
 *   CONDUCTOR_ROOT_PATH       - Path to the repository root
 */

import { $ } from "bun";

const workspaceName = process.env.CONDUCTOR_WORKSPACE_NAME;

if (!workspaceName) {
  console.log("CONDUCTOR_WORKSPACE_NAME is not set. Nothing to tear down.");
  process.exit(0);
}

const hash = Buffer.from(workspaceName).reduce((acc, byte) => acc + byte, 0);
const offset = hash % 50;
const dbName = `keryx_${offset}`;
const dbNameTest = `keryx_${offset}_test`;
const redisDb = (offset * 2) % 16;
const redisDbTest = (offset * 2 + 1) % 16;

console.log(`Workspace: ${workspaceName}`);
console.log(`Dropping databases: ${dbName}, ${dbNameTest}`);
console.log(`Flushing Redis DBs: ${redisDb}, ${redisDbTest}`);

// Drop Postgres databases
for (const db of [dbName, dbNameTest]) {
  const result = await $`dropdb --if-exists ${db}`.nothrow();
  if (result.exitCode === 0) {
    console.log(`Dropped database '${db}'.`);
  } else {
    console.log(`WARNING: Could not drop database '${db}'.`);
  }
}

// Flush Redis databases
for (const db of [redisDb, redisDbTest]) {
  const result = await $`redis-cli -n ${db} FLUSHDB`.nothrow();
  if (result.exitCode === 0) {
    console.log(`Flushed Redis DB ${db}.`);
  } else {
    console.log(`WARNING: Could not flush Redis DB ${db}.`);
  }
}

console.log("Teardown complete.");
