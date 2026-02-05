#!/bin/bash
#
# Bootstrap script for bun-actionhero in Claude Code cloud environment
# This script is run automatically via SessionStart hook when a session begins
#

set -e

# -----------------------------------------------------------------------------
# Only run in Claude Code cloud environment
# -----------------------------------------------------------------------------
if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
    echo "Not running in Claude Code cloud environment (CLAUDE_CODE_REMOTE != true)"
    echo "Skipping bootstrap. Use 'docker compose up' for local development."
    exit 0
fi

echo "=== bun-actionhero bootstrap script ==="
echo "Running in Claude Code cloud environment"
echo ""

# -----------------------------------------------------------------------------
# 1. Start PostgreSQL
# -----------------------------------------------------------------------------
echo "[1/6] Starting PostgreSQL..."

# Check if PostgreSQL is already running
if pg_isready -q 2>/dev/null; then
    echo "  PostgreSQL is already running"
else
    # Start PostgreSQL service (varies by environment)
    if command -v pg_ctlcluster &>/dev/null; then
        # Debian/Ubuntu style
        sudo pg_ctlcluster 16 main start 2>/dev/null || sudo pg_ctlcluster 15 main start 2>/dev/null || true
    elif command -v pg_ctl &>/dev/null; then
        # Direct pg_ctl
        pg_ctl start -D /var/lib/postgresql/data 2>/dev/null || true
    fi

    # Wait for PostgreSQL to be ready (up to 30 seconds)
    for i in {1..30}; do
        if pg_isready -q 2>/dev/null; then
            echo "  PostgreSQL started successfully"
            break
        fi
        sleep 1
    done
fi

# Verify PostgreSQL is running
if ! pg_isready -q 2>/dev/null; then
    echo "  WARNING: PostgreSQL may not be running. Tests may fail."
fi

# -----------------------------------------------------------------------------
# 2. Start Redis
# -----------------------------------------------------------------------------
echo "[2/6] Starting Redis..."

# Check if Redis is already running
if redis-cli ping 2>/dev/null | grep -q PONG; then
    echo "  Redis is already running"
else
    # Start Redis in background
    if command -v redis-server &>/dev/null; then
        redis-server --daemonize yes 2>/dev/null || true
    fi

    # Wait for Redis to be ready (up to 10 seconds)
    for i in {1..10}; do
        if redis-cli ping 2>/dev/null | grep -q PONG; then
            echo "  Redis started successfully"
            break
        fi
        sleep 1
    done
fi

# Verify Redis is running
if ! redis-cli ping 2>/dev/null | grep -q PONG; then
    echo "  WARNING: Redis may not be running. Tests may fail."
fi

# -----------------------------------------------------------------------------
# 3. Create databases
# -----------------------------------------------------------------------------
echo "[3/6] Creating databases..."

# Determine PostgreSQL user - try postgres first, then current user
if psql -U postgres -lqt &>/dev/null; then
    PG_USER="postgres"
elif psql -lqt &>/dev/null; then
    PG_USER="$(whoami)"
else
    echo "  WARNING: Cannot determine PostgreSQL user. Trying 'postgres'..."
    PG_USER="postgres"
fi
echo "  Using PostgreSQL user: $PG_USER"

# Create main database
if psql -U "$PG_USER" -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw bun; then
    echo "  Database 'bun' already exists"
else
    createdb -U "$PG_USER" bun 2>/dev/null && echo "  Created database 'bun'" || echo "  Could not create database 'bun' (may already exist)"
fi

# Create test database
if psql -U "$PG_USER" -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw bun-test; then
    echo "  Database 'bun-test' already exists"
else
    createdb -U "$PG_USER" bun-test 2>/dev/null && echo "  Created database 'bun-test'" || echo "  Could not create database 'bun-test' (may already exist)"
fi

# -----------------------------------------------------------------------------
# 4. Install dependencies
# -----------------------------------------------------------------------------
echo "[4/6] Installing dependencies..."

cd "$CLAUDE_PROJECT_DIR"

if [ -f "bun.lockb" ] || [ -f "package.json" ]; then
    bun install --frozen-lockfile 2>/dev/null || bun install
    echo "  Dependencies installed"
else
    echo "  No package.json found, skipping dependency installation"
fi

# -----------------------------------------------------------------------------
# 5. Set up environment files
# -----------------------------------------------------------------------------
echo "[5/6] Setting up environment files..."

# Backend .env
if [ ! -f "$CLAUDE_PROJECT_DIR/backend/.env" ]; then
    if [ -f "$CLAUDE_PROJECT_DIR/backend/.env.example" ]; then
        cp "$CLAUDE_PROJECT_DIR/backend/.env.example" "$CLAUDE_PROJECT_DIR/backend/.env"
        echo "  Created backend/.env from .env.example"
    fi
else
    echo "  backend/.env already exists"
fi

# Frontend .env
if [ ! -f "$CLAUDE_PROJECT_DIR/frontend/.env" ]; then
    if [ -f "$CLAUDE_PROJECT_DIR/frontend/.env.example" ]; then
        cp "$CLAUDE_PROJECT_DIR/frontend/.env.example" "$CLAUDE_PROJECT_DIR/frontend/.env"
        echo "  Created frontend/.env from .env.example"
    fi
else
    echo "  frontend/.env already exists"
fi

# -----------------------------------------------------------------------------
# 6. Export environment variables for the session
# -----------------------------------------------------------------------------
echo "[6/6] Configuring session environment..."

if [ -n "$CLAUDE_ENV_FILE" ]; then
    # Use the detected PostgreSQL user in connection strings
    cat >> "$CLAUDE_ENV_FILE" << ENVEOF
export DATABASE_URL="postgres://${PG_USER}@localhost:5432/bun"
export DATABASE_URL_TEST="postgres://${PG_USER}@localhost:5432/bun-test"
export REDIS_URL="redis://localhost:6379/0"
export REDIS_URL_TEST="redis://localhost:6379/1"
export NODE_ENV="development"
ENVEOF
    echo "  Session environment variables configured"
    echo "  DATABASE_URL=postgres://${PG_USER}@localhost:5432/bun"
    echo "  DATABASE_URL_TEST=postgres://${PG_USER}@localhost:5432/bun-test"
else
    echo "  CLAUDE_ENV_FILE not set (running outside Claude Code?)"
fi

# -----------------------------------------------------------------------------
# Done!
# -----------------------------------------------------------------------------
echo ""
echo "=== Bootstrap complete! ==="
echo ""
echo "Services:"
echo "  - PostgreSQL: $(pg_isready -q 2>/dev/null && echo 'running' || echo 'not running')"
echo "  - Redis: $(redis-cli ping 2>/dev/null | grep -q PONG && echo 'running' || echo 'not running')"
echo ""
echo "You can now run:"
echo "  bun test-backend   # Run backend tests"
echo "  bun test-frontend  # Run frontend tests"
echo "  bun dev            # Start development servers"
echo ""

exit 0
