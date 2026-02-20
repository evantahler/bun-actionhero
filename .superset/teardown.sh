#!/usr/bin/env bash
#
# Superset workspace teardown script.
# Drops Postgres databases and flushes Redis DBs created by setup.sh.
#
# Environment variables provided by Superset:
#   SUPERSET_WORKSPACE_NAME  - Workspace/worktree name
#   SUPERSET_ROOT_PATH       - Path to the main repository
#

set -euo pipefail

# Ensure Homebrew Postgres binaries (dropdb) are on PATH
if command -v brew &>/dev/null; then
  PG_PREFIX="$(brew --prefix postgresql@17 2>/dev/null || true)"
  if [ -n "$PG_PREFIX" ] && [ -d "$PG_PREFIX/bin" ]; then
    export PATH="$PG_PREFIX/bin:$PATH"
  fi
fi

if [ -z "${SUPERSET_WORKSPACE_NAME:-}" ]; then
  echo "SUPERSET_WORKSPACE_NAME is not set. Nothing to tear down."
  exit 0
fi

HASH=$(echo -n "$SUPERSET_WORKSPACE_NAME" | cksum | awk '{print $1}')
OFFSET=$((HASH % 50))
DB_NAME="keryx_${OFFSET}"
DB_NAME_TEST="keryx_${OFFSET}_test"
REDIS_DB=$(( (OFFSET * 2) % 16 ))
REDIS_DB_TEST=$(( (OFFSET * 2 + 1) % 16 ))

echo "Workspace: ${SUPERSET_WORKSPACE_NAME}"
echo "Dropping databases: ${DB_NAME}, ${DB_NAME_TEST}"
echo "Flushing Redis DBs: ${REDIS_DB}, ${REDIS_DB_TEST}"

# Drop Postgres databases
for DB in "$DB_NAME" "$DB_NAME_TEST"; do
  dropdb --if-exists "$DB" 2>/dev/null && echo "Dropped database '${DB}'." || echo "WARNING: Could not drop database '${DB}'."
done

# Flush Redis databases
for DB in "$REDIS_DB" "$REDIS_DB_TEST"; do
  redis-cli -n "$DB" FLUSHDB 2>/dev/null && echo "Flushed Redis DB ${DB}." || echo "WARNING: Could not flush Redis DB ${DB}."
done

echo "Teardown complete."
