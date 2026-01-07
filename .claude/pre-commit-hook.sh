#!/usr/bin/env bash

# Claude Code Pre-Commit Hook for bun-actionhero
# Enforces code quality, formatting, and project-specific best practices

set -e

echo "🔍 Running pre-commit checks..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if any checks fail
CHECKS_FAILED=0

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR)

if [ -z "$STAGED_FILES" ]; then
  echo "${YELLOW}⚠️  No staged files found${NC}"
  exit 0
fi

# Helper function to print section headers
print_section() {
  echo ""
  echo "═══════════════════════════════════════════════════"
  echo "$1"
  echo "═══════════════════════════════════════════════════"
}

# 1. Check for direct commits to main branch
print_section "1️⃣  Checking branch protection"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" = "main" ]; then
  echo "${RED}❌ Direct commits to 'main' branch are not allowed!${NC}"
  echo "   Please create a feature branch and submit a PR."
  echo "   Use: git checkout -b feature/your-feature-name"
  CHECKS_FAILED=1
else
  echo "${GREEN}✓${NC} Not committing to main branch (on: $CURRENT_BRANCH)"
fi

# 2. Auto-format code with Prettier
print_section "2️⃣  Auto-formatting code"
BACKEND_FILES=$(echo "$STAGED_FILES" | grep -E '^backend/.*\.(ts|tsx|js|jsx|json)$' || true)
FRONTEND_FILES=$(echo "$STAGED_FILES" | grep -E '^frontend/.*\.(ts|tsx|js|jsx|json)$' || true)

if [ -n "$BACKEND_FILES" ]; then
  echo "Formatting backend files..."
  echo "$BACKEND_FILES" | xargs bun format-backend --write || {
    echo "${RED}❌ Failed to format backend files${NC}"
    CHECKS_FAILED=1
  }
  # Re-stage formatted files
  echo "$BACKEND_FILES" | xargs git add
  echo "${GREEN}✓${NC} Backend files formatted"
fi

if [ -n "$FRONTEND_FILES" ]; then
  echo "Formatting frontend files..."
  echo "$FRONTEND_FILES" | xargs bun format-frontend --write || {
    echo "${RED}❌ Failed to format frontend files${NC}"
    CHECKS_FAILED=1
  }
  # Re-stage formatted files
  echo "$FRONTEND_FILES" | xargs git add
  echo "${GREEN}✓${NC} Frontend files formatted"
fi

if [ -z "$BACKEND_FILES" ] && [ -z "$FRONTEND_FILES" ]; then
  echo "${GREEN}✓${NC} No files to format"
fi

# 3. Check for console.log statements
print_section "3️⃣  Checking for console.log statements"
TS_FILES=$(echo "$STAGED_FILES" | grep -E '\.(ts|tsx|js|jsx)$' | grep -v '__tests__' | grep -v 'test.ts' || true)

if [ -n "$TS_FILES" ]; then
  CONSOLE_LOGS=$(echo "$TS_FILES" | xargs grep -n "console\.log" 2>/dev/null || true)

  if [ -n "$CONSOLE_LOGS" ]; then
    echo "${YELLOW}⚠️  Found console.log statements (use logger instead):${NC}"
    echo "$CONSOLE_LOGS"
    echo ""
    echo "   Replace with: import { logger } from './api';"
    echo "                 logger.info('message');"
    CHECKS_FAILED=1
  else
    echo "${GREEN}✓${NC} No console.log statements found"
  fi
else
  echo "${GREEN}✓${NC} No TypeScript files to check"
fi

# 4. Validate Zod schemas on Action changes
print_section "4️⃣  Validating Action definitions"
ACTION_FILES=$(echo "$STAGED_FILES" | grep -E '^backend/actions/.*\.ts$' || true)

if [ -n "$ACTION_FILES" ]; then
  for file in $ACTION_FILES; do
    # Check for Action implementation
    if grep -q "implements Action" "$file"; then
      echo "Validating: $file"

      # Check for Zod inputs
      if ! grep -q "inputs = z\." "$file"; then
        echo "${RED}❌ Action missing Zod schema: $file${NC}"
        echo "   Actions must define: inputs = z.object({...})"
        CHECKS_FAILED=1
      fi

      # Check for .secret() on password fields
      if grep -q "password\|secret\|token\|apiKey" "$file"; then
        if ! grep -q "\.secret()" "$file"; then
          echo "${YELLOW}⚠️  Sensitive field detected but no .secret() mixin: $file${NC}"
          echo "   Use: z.string().secret() for passwords, tokens, etc."
          CHECKS_FAILED=1
        fi
      fi

      # Check for middleware declaration
      if ! grep -q "middleware = " "$file"; then
        echo "${YELLOW}⚠️  Action without explicit middleware: $file${NC}"
        echo "   Consider: middleware = [SessionMiddleware] or middleware = []"
      fi

      echo "${GREEN}✓${NC} $file validated"
    fi
  done
else
  echo "${GREEN}✓${NC} No Action files changed"
fi

# 5. Require tests for new Actions
print_section "5️⃣  Checking test coverage for new Actions"
NEW_ACTION_FILES=$(git diff --cached --name-only --diff-filter=A | grep -E '^backend/actions/.*\.ts$' || true)

if [ -n "$NEW_ACTION_FILES" ]; then
  for action_file in $NEW_ACTION_FILES; do
    # Extract action name from file path
    ACTION_NAME=$(basename "$action_file" .ts)
    TEST_FILE="backend/__tests__/actions/${ACTION_NAME}.test.ts"

    if [ ! -f "$TEST_FILE" ]; then
      echo "${RED}❌ Missing test file for new Action: $action_file${NC}"
      echo "   Expected: $TEST_FILE"
      CHECKS_FAILED=1
    else
      echo "${GREEN}✓${NC} Test exists for: $action_file"
    fi
  done
else
  echo "${GREEN}✓${NC} No new Action files added"
fi

# 6. Run tests for changed workspaces
print_section "6️⃣  Running tests for changed workspaces"
BACKEND_CHANGED=$(echo "$STAGED_FILES" | grep -E '^backend/' || true)
FRONTEND_CHANGED=$(echo "$STAGED_FILES" | grep -E '^frontend/' || true)

if [ -n "$BACKEND_CHANGED" ]; then
  echo "Running backend tests..."
  if bun test-backend; then
    echo "${GREEN}✓${NC} Backend tests passed"
  else
    echo "${RED}❌ Backend tests failed${NC}"
    CHECKS_FAILED=1
  fi
fi

if [ -n "$FRONTEND_CHANGED" ]; then
  echo "Running frontend tests..."
  if bun test-frontend; then
    echo "${GREEN}✓${NC} Frontend tests passed"
  else
    echo "${RED}❌ Frontend tests failed${NC}"
    CHECKS_FAILED=1
  fi
fi

if [ -z "$BACKEND_CHANGED" ] && [ -z "$FRONTEND_CHANGED" ]; then
  echo "${GREEN}✓${NC} No workspace changes detected"
fi

# Final result
print_section "Pre-commit checks complete"
if [ $CHECKS_FAILED -eq 1 ]; then
  echo "${RED}❌ Some checks failed. Please fix the issues above.${NC}"
  echo ""
  echo "To bypass these checks (not recommended), use:"
  echo "  git commit --no-verify"
  exit 1
else
  echo "${GREEN}✅ All checks passed! Ready to commit.${NC}"
  exit 0
fi
