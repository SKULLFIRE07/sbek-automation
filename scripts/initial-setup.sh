#!/bin/bash
# SBEK Automation — One-Command Setup
# Usage: ./scripts/initial-setup.sh

set -e

echo "========================================="
echo "  SBEK Automation — Initial Setup"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check() {
  if command -v "$1" &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} $1 found: $(eval "$2" 2>/dev/null || echo 'installed')"
    return 0
  else
    echo -e "  ${RED}✗${NC} $1 not found"
    return 1
  fi
}

# 1. Check prerequisites
echo "--- Checking Prerequisites ---"
MISSING=0

check "docker" "docker --version" || MISSING=1
check "docker compose" "docker compose version" && true || {
  check "docker-compose" "docker-compose --version" || MISSING=1
}
check "node" "node --version" || MISSING=1
check "npm" "npm --version" || MISSING=1

if [ "$MISSING" -eq 1 ]; then
  echo -e "\n${RED}Missing prerequisites. Please install them and retry.${NC}"
  exit 1
fi
echo ""

# 2. Check .env file
echo "--- Checking Configuration ---"
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo -e "  ${YELLOW}!${NC} .env not found. Copying from .env.example..."
    cp .env.example .env
    echo -e "  ${YELLOW}!${NC} Please edit .env with your actual credentials before continuing."
    echo -e "  ${YELLOW}!${NC} Run this script again after updating .env"
    exit 0
  else
    echo -e "  ${RED}✗${NC} Neither .env nor .env.example found!"
    exit 1
  fi
else
  echo -e "  ${GREEN}✓${NC} .env file found"
fi
echo ""

# 3. Install Node.js dependencies
echo "--- Installing Dependencies ---"
npm install
echo -e "  ${GREEN}✓${NC} Node modules installed"
echo ""

# 4. Build TypeScript
echo "--- Building TypeScript ---"
npm run build
echo -e "  ${GREEN}✓${NC} TypeScript compiled"
echo ""

# 5. Start Docker services
echo "--- Starting Docker Services ---"
docker compose up -d
echo ""

# 6. Wait for services to be healthy
echo "--- Waiting for Services ---"
echo "  Waiting for PostgreSQL..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U sbek &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} PostgreSQL is ready"
    break
  fi
  sleep 1
  if [ "$i" -eq 30 ]; then
    echo -e "  ${RED}✗${NC} PostgreSQL failed to start"
    exit 1
  fi
done

echo "  Waiting for Redis..."
for i in $(seq 1 15); do
  if docker compose exec -T redis redis-cli ping &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Redis is ready"
    break
  fi
  sleep 1
done
echo ""

# 7. Run database migrations
echo "--- Running Database Migrations ---"
npm run db:generate 2>/dev/null || true
npm run db:migrate 2>/dev/null || echo -e "  ${YELLOW}!${NC} Migrations skipped (run manually if needed)"
echo ""

# 8. Setup Google Sheets (if credentials available)
echo "--- Google Sheets Setup ---"
if grep -q "your_spreadsheet_id_here" .env 2>/dev/null || grep -q "YOUR_KEY_HERE" .env 2>/dev/null; then
  echo -e "  ${YELLOW}!${NC} Google credentials not configured. Skipping Sheets setup."
  echo "  Run 'npm run setup:sheets' after adding Google credentials to .env"
else
  npm run setup:sheets 2>/dev/null && echo -e "  ${GREEN}✓${NC} Google Sheets configured" || echo -e "  ${YELLOW}!${NC} Sheets setup failed. Run 'npm run setup:sheets' manually."
fi
echo ""

# 9. Summary
echo "========================================="
echo "  Setup Complete!"
echo "========================================="
echo ""
echo "Services running:"
docker compose ps --format "  {{.Name}}: {{.Status}}" 2>/dev/null || docker compose ps
echo ""
echo "Endpoints:"
echo "  App:     http://localhost:${PORT:-3000}"
echo "  Health:  http://localhost:${PORT:-3000}/health"
echo "  Crawler: http://localhost:3001"
echo ""
echo "Next steps:"
echo "  1. Fill in all credentials in .env"
echo "  2. Run: npm run setup:sheets"
echo "  3. Run: npx tsx scripts/register-webhooks.ts"
echo "  4. Run: ./scripts/test-webhooks.sh"
echo "  5. Monitor: http://localhost:${PORT:-3000}/jobs/status"
echo ""
