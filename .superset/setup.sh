#!/usr/bin/env bash
#
# Superset workspace setup script.
# Reads .env.example files and overrides workspace-specific variables
# (ports, Redis DBs, Postgres DBs) using a hash of SUPERSET_WORKSPACE_NAME
# for isolation across parallel worktrees.
#
# Environment variables provided by Superset:
#   SUPERSET_WORKSPACE_NAME  - Workspace/worktree name
#   SUPERSET_ROOT_PATH       - Path to the main repository
#

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Ensure Homebrew Postgres binaries (psql, createdb, pg_isready) are on PATH
if command -v brew &>/dev/null; then
  PG_PREFIX="$(brew --prefix postgresql@17 2>/dev/null || true)"
  if [ -n "$PG_PREFIX" ] && [ -d "$PG_PREFIX/bin" ]; then
    export PATH="$PG_PREFIX/bin:$PATH"
  fi
fi

if [ -z "${SUPERSET_WORKSPACE_NAME:-}" ]; then
  echo "SUPERSET_WORKSPACE_NAME is not set. Using defaults."
  BACKEND_PORT=8080
  FRONTEND_PORT=3000
  REDIS_DB=0
  REDIS_DB_TEST=1
  DB_NAME="keryx"
  DB_NAME_TEST="keryx-test"
else
  echo "Workspace: ${SUPERSET_WORKSPACE_NAME}"

  # Derive a numeric offset from the workspace name (0-49)
  HASH=$(echo -n "$SUPERSET_WORKSPACE_NAME" | cksum | awk '{print $1}')
  OFFSET=$((HASH % 50))

  BACKEND_PORT=$((8080 + OFFSET))
  FRONTEND_PORT=$((3000 + OFFSET))
  REDIS_DB=$(( (OFFSET * 2) % 16 ))
  REDIS_DB_TEST=$(( (OFFSET * 2 + 1) % 16 ))
  DB_NAME="keryx_${OFFSET}"
  DB_NAME_TEST="keryx_${OFFSET}_test"
fi

echo "Backend port:    ${BACKEND_PORT}"
echo "Frontend port:   ${FRONTEND_PORT}"
echo "Redis DB:        ${REDIS_DB} (test: ${REDIS_DB_TEST})"
echo "Postgres DB:     ${DB_NAME} (test: ${DB_NAME_TEST})"

# Ensure Postgres is running via Homebrew
if pg_isready -q 2>/dev/null; then
  echo "Postgres is running."
else
  echo "Postgres is not running. Starting via Homebrew..."
  brew services start postgresql@17 2>/dev/null || true
  for i in $(seq 1 10); do
    pg_isready -q 2>/dev/null && break
    sleep 0.5
  done
  echo "Postgres started."
fi

# Create Postgres databases if they don't exist
for DB in "$DB_NAME" "$DB_NAME_TEST"; do
  if psql -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw "$DB"; then
    echo "Database '${DB}' already exists."
  else
    echo "Creating database '${DB}'..."
    createdb "$DB" 2>/dev/null || echo "WARNING: Could not create database '${DB}'. Create it manually: createdb ${DB}"
  fi
done

# Helper: apply overrides to a .env.example and write to .env
# Usage: apply_env_overrides <example_file> <output_file> <KEY=VALUE>...
apply_env_overrides() {
  local example_file="$1"
  local output_file="$2"
  shift 2

  cp "$example_file" "$output_file"

  for kv in "$@"; do
    local key="${kv%%=*}"
    local val="${kv#*=}"
    if grep -q "^#\{0,1\}[[:space:]]*${key}=" "$output_file"; then
      sed -i '' "s|^#*[[:space:]]*${key}=.*|${key}=${val}|" "$output_file"
    else
      echo "${key}=${val}" >> "$output_file"
    fi
  done
}

APPLICATION_URL="\"http://localhost:${BACKEND_PORT}\""
ALLOWED_ORIGINS="\"http://localhost:${FRONTEND_PORT},http://localhost:3000\""
DATABASE_URL="\"postgres://${USER}@localhost:5432/${DB_NAME}\""
DATABASE_URL_TEST="\"postgres://${USER}@localhost:5432/${DB_NAME_TEST}\""
REDIS_URL="\"redis://localhost:6379/${REDIS_DB}\""
REDIS_URL_TEST="\"redis://localhost:6379/${REDIS_DB_TEST}\""

# Write packages/keryx/.env
apply_env_overrides \
  "${ROOT_DIR}/packages/keryx/.env.example" \
  "${ROOT_DIR}/packages/keryx/.env" \
  "WEB_SERVER_PORT=${BACKEND_PORT}" \
  "APPLICATION_URL=${APPLICATION_URL}" \
  "WEB_SERVER_ALLOWED_ORIGINS=${ALLOWED_ORIGINS}" \
  "DATABASE_URL=${DATABASE_URL}" \
  "DATABASE_URL_TEST=${DATABASE_URL_TEST}" \
  "REDIS_URL=${REDIS_URL}" \
  "REDIS_URL_TEST=${REDIS_URL_TEST}"
echo "Wrote packages/keryx/.env"

# Write example/backend/.env
apply_env_overrides \
  "${ROOT_DIR}/example/backend/.env.example" \
  "${ROOT_DIR}/example/backend/.env" \
  "WEB_SERVER_PORT=${BACKEND_PORT}" \
  "APPLICATION_URL=${APPLICATION_URL}" \
  "WEB_SERVER_ALLOWED_ORIGINS=${ALLOWED_ORIGINS}" \
  "DATABASE_URL=${DATABASE_URL}" \
  "DATABASE_URL_TEST=${DATABASE_URL_TEST}" \
  "REDIS_URL=${REDIS_URL}" \
  "REDIS_URL_TEST=${REDIS_URL_TEST}"
echo "Wrote example/backend/.env"

# Write example/frontend/.env
apply_env_overrides \
  "${ROOT_DIR}/example/frontend/.env.example" \
  "${ROOT_DIR}/example/frontend/.env" \
  "NEXT_PUBLIC_API_URL=http://localhost:${BACKEND_PORT}" \
  "PORT=${FRONTEND_PORT}"
echo "Wrote example/frontend/.env"

echo ""
echo "Setup complete! Run 'bun dev' to start both servers."
