#!/usr/bin/env bun
/**
 * Conductor workspace teardown script.
 * Drops Postgres databases and flushes Redis DBs created by conductor-setup.ts.
 *
 * Usage: bun conductor-teardown.ts
 */

import { $ } from "bun";

const conductorPort = Bun.env.CONDUCTOR_PORT
  ? parseInt(Bun.env.CONDUCTOR_PORT)
  : undefined;

if (!conductorPort) {
  console.log("CONDUCTOR_PORT is not set. Nothing to tear down.");
  process.exit(0);
}

const dbName = `keryx_${conductorPort}`;
const dbNameTest = `keryx_${conductorPort}_test`;
const offset = Math.floor((conductorPort - 55000) / 10);
const redisDb = (offset * 2) % 16;
const redisDbTest = (offset * 2 + 1) % 16;

console.log(`CONDUCTOR_PORT=${conductorPort}`);
console.log(`Dropping databases: ${dbName}, ${dbNameTest}`);
console.log(`Flushing Redis DBs: ${redisDb}, ${redisDbTest}`);

// Drop Postgres databases
for (const db of [dbName, dbNameTest]) {
  try {
    await $`dropdb --if-exists ${db}`.quiet();
    console.log(`Dropped database '${db}'.`);
  } catch {
    console.log(`WARNING: Could not drop database '${db}'.`);
  }
}

// Flush Redis databases
for (const db of [redisDb, redisDbTest]) {
  try {
    await $`redis-cli -n ${db} FLUSHDB`.quiet();
    console.log(`Flushed Redis DB ${db}.`);
  } catch {
    console.log(`WARNING: Could not flush Redis DB ${db}.`);
  }
}

console.log("Teardown complete.");
