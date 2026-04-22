#!/usr/bin/env bash
# =============================================================================
# Thea EHR — Database Setup Script
# Usage: ./scripts/db-setup.sh [--reset] [--dev]
# =============================================================================
set -euo pipefail

echo "╔══════════════════════════════════════╗"
echo "║   Thea EHR Database Setup            ║"
echo "╚══════════════════════════════════════╝"

# Check for DATABASE_URL
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f .env ]; then
    export $(grep -E '^DATABASE_URL=' .env | xargs)
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ ERROR: DATABASE_URL is not set."
  echo "   Please create a .env file with:"
  echo "   DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/thea_main"
  exit 1
fi

echo "✓ DATABASE_URL is set"

# Generate Prisma client
echo ""
echo "→ Step 1: Generating Prisma client..."
yarn prisma generate
echo "✓ Prisma client generated"

# Handle flags
RESET=false
DEV=false
for arg in "$@"; do
  case $arg in
    --reset) RESET=true ;;
    --dev)   DEV=true ;;
  esac
done

if [ "$RESET" = true ]; then
  echo ""
  echo "⚠️  WARNING: --reset flag detected. This will DESTROY ALL DATA."
  read -p "   Type 'yes' to confirm: " confirm
  if [ "$confirm" = "yes" ]; then
    echo "→ Resetting database..."
    yarn prisma migrate reset --force
    echo "✓ Database reset"
  else
    echo "Aborted."
    exit 0
  fi
elif [ "$DEV" = true ]; then
  echo ""
  echo "→ Step 2: Running dev migrations..."
  yarn prisma migrate dev
  echo "✓ Dev migrations complete"
else
  echo ""
  echo "→ Step 2: Applying production migrations..."
  yarn prisma migrate deploy
  echo "✓ Migrations applied"
fi

echo ""
echo "╔══════════════════════════════════════╗"
echo "║   Setup complete!                    ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "Useful commands:"
echo "  yarn db:studio      → Open Prisma Studio"
echo "  yarn db:generate    → Regenerate Prisma client"
echo "  yarn db:migrate:dev → Create a new migration"
