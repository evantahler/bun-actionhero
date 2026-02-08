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
# 1. Ensure Bun is installed
# -----------------------------------------------------------------------------
echo "[1/7] Ensuring Bun is installed..."

if command -v bun &>/dev/null; then
    echo "  Bun is already installed: $(bun --version 2>/dev/null || echo 'unknown')"
else
    echo "  Bun not found; installing..."
    if command -v curl &>/dev/null; then
        curl -fsSL https://bun.sh/install | bash
    elif command -v wget &>/dev/null; then
        wget -qO- https://bun.sh/install | bash
    else
        echo "  WARNING: Neither curl nor wget found; cannot install Bun automatically."
    fi
fi

# Ensure Bun is available in this script's PATH even if shell profiles aren't sourced
export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
export PATH="$BUN_INSTALL/bin:$PATH"

if command -v bun &>/dev/null; then
    echo "  Bun ready: $(bun --version 2>/dev/null || echo 'unknown')"
else
    echo "  WARNING: Bun is still not available on PATH. Dependency installation may fail."
fi

# -----------------------------------------------------------------------------
# 2. Start PostgreSQL
# -----------------------------------------------------------------------------
echo "[2/7] Starting PostgreSQL..."

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

# Set postgres user password to match .env.example expectations
# This enables TCP connections with password authentication
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';" 2>/dev/null || true
echo "  PostgreSQL password configured"

# -----------------------------------------------------------------------------
# 3. Start Redis
# -----------------------------------------------------------------------------
echo "[3/7] Starting Redis..."

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
# 4. Create databases
# -----------------------------------------------------------------------------
echo "[4/7] Creating databases..."

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
# 5. Install dependencies
# -----------------------------------------------------------------------------
echo "[5/7] Installing dependencies..."

cd "$CLAUDE_PROJECT_DIR"

if [ -f "bun.lockb" ] || [ -f "package.json" ]; then
    bun install --frozen-lockfile 2>/dev/null || bun install
    echo "  Dependencies installed"
else
    echo "  No package.json found, skipping dependency installation"
fi

# -----------------------------------------------------------------------------
# 6. Set up environment files
# -----------------------------------------------------------------------------
echo "[6/7] Setting up environment files..."

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
# 7. Export environment variables for the session
# -----------------------------------------------------------------------------
echo "[7/7] Configuring session environment..."

if [ -n "$CLAUDE_ENV_FILE" ]; then
    # Use connection strings matching .env.example format (with password)
    cat >> "$CLAUDE_ENV_FILE" << 'ENVEOF'
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/bun"
export DATABASE_URL_TEST="postgres://postgres:postgres@localhost:5432/bun-test"
export REDIS_URL="redis://localhost:6379/0"
export REDIS_URL_TEST="redis://localhost:6379/1"
export NODE_ENV="development"
ENVEOF
    echo "  Session environment variables configured"
    echo "  DATABASE_URL=postgres://postgres:postgres@localhost:5432/bun"
    echo "  DATABASE_URL_TEST=postgres://postgres:postgres@localhost:5432/bun-test"
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
