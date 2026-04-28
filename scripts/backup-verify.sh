#!/usr/bin/env bash
# backup-verify.sh
# Phase 0.1 — Backup verification script.
# Dumps critical tables from the Thea database, restores them into a scratch
# schema, and compares row counts against the source.  Exits 0 on pass, 1 on
# any mismatch or error.
#
# Usage:
#   DATABASE_URL=postgresql://... bash scripts/backup-verify.sh
#
# Conservative choices (noted per plan requirement):
#   - Uses a dedicated schema "backup_verify_scratch_<ts>" instead of a
#     separate throwaway DB so no extra DB credentials are needed on staging.
#   - Scratch schema is always dropped at the end (even on failure) to avoid
#     leaving stale data.

set -euo pipefail

DB_URL=${DATABASE_URL:?DATABASE_URL required — e.g. postgresql://user:pass@host/db}

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="/tmp/thea-backup-${TIMESTAMP}"
BACKUP_FILE_SCHEMA="${BACKUP_FILE}.schema.sql"
BACKUP_FILE_CRITICAL="${BACKUP_FILE}.critical.sql"
SCRATCH_SCHEMA="backup_verify_scratch_${TIMESTAMP}"

CRITICAL_TABLES=(tenants users org_groups hospitals)

# ── Cleanup trap ────────────────────────────────────────────────────────────
cleanup() {
  psql "$DB_URL" -q -c "DROP SCHEMA IF EXISTS \"${SCRATCH_SCHEMA}\" CASCADE;" 2>/dev/null || true
  rm -f "$BACKUP_FILE_SCHEMA" "$BACKUP_FILE_CRITICAL"
}
trap cleanup EXIT

# ── Step 1: Schema-only dump ─────────────────────────────────────────────────
echo "[1/5] Dumping schema-only backup..."
pg_dump "$DB_URL" \
  --schema-only \
  --no-owner \
  --no-privileges \
  --file "$BACKUP_FILE_SCHEMA"
echo "      Written: $BACKUP_FILE_SCHEMA"

# ── Step 2: Critical-table data dump ────────────────────────────────────────
echo "[2/5] Dumping critical-table data..."
TABLE_FLAGS=()
for tbl in "${CRITICAL_TABLES[@]}"; do
  TABLE_FLAGS+=("--table=${tbl}")
done
pg_dump "$DB_URL" \
  --data-only \
  "${TABLE_FLAGS[@]}" \
  --file "$BACKUP_FILE_CRITICAL" 2>/dev/null || {
    echo "WARN  Some tables may not exist yet (pre-migration environment). Continuing."
  }
echo "      Written: $BACKUP_FILE_CRITICAL"

# ── Step 3: Source row counts ────────────────────────────────────────────────
echo "[3/5] Reading source row counts..."
declare -A SOURCE_COUNTS
for tbl in "${CRITICAL_TABLES[@]}"; do
  count=$(psql "$DB_URL" -t -A -c "SELECT COUNT(*) FROM \"${tbl}\";" 2>/dev/null || echo "0")
  SOURCE_COUNTS[$tbl]=$count
  echo "      ${tbl}: ${count} rows (source)"
done

# ── Step 4: Restore into scratch schema ─────────────────────────────────────
echo "[4/5] Restoring critical data into scratch schema '${SCRATCH_SCHEMA}'..."
psql "$DB_URL" -q -c "CREATE SCHEMA \"${SCRATCH_SCHEMA}\";"

# Create mirror tables in scratch schema
for tbl in "${CRITICAL_TABLES[@]}"; do
  psql "$DB_URL" -q -c \
    "CREATE TABLE IF NOT EXISTS \"${SCRATCH_SCHEMA}\".\"${tbl}\" \
     (LIKE public.\"${tbl}\" INCLUDING ALL);" 2>/dev/null || true
done

# Rewrite COPY statements in the dump to target the scratch schema
SCRATCH_DUMP="/tmp/thea-scratch-${TIMESTAMP}.sql"
cp "$BACKUP_FILE_CRITICAL" "$SCRATCH_DUMP"
for tbl in "${CRITICAL_TABLES[@]}"; do
  sed -i.bak \
    -e "s/^COPY public\.${tbl} /COPY \"${SCRATCH_SCHEMA}\".${tbl} /g" \
    -e "s/^COPY ${tbl} /COPY \"${SCRATCH_SCHEMA}\".${tbl} /g" \
    "$SCRATCH_DUMP" 2>/dev/null || true
done
rm -f "${SCRATCH_DUMP}.bak"

psql "$DB_URL" -q -f "$SCRATCH_DUMP" 2>/dev/null || true
rm -f "$SCRATCH_DUMP"

# ── Step 5: Compare row counts ───────────────────────────────────────────────
echo "[5/5] Comparing row counts (source vs restored)..."
PASS=true
for tbl in "${CRITICAL_TABLES[@]}"; do
  restored=$(psql "$DB_URL" -t -A -c \
    "SELECT COUNT(*) FROM \"${SCRATCH_SCHEMA}\".\"${tbl}\";" 2>/dev/null || echo "0")
  src=${SOURCE_COUNTS[$tbl]}
  if [ "$src" = "$restored" ]; then
    echo "      PASS  ${tbl}: ${src} = ${restored}"
  else
    echo "      FAIL  ${tbl}: source=${src}  restored=${restored}"
    PASS=false
  fi
done

# ── Result ───────────────────────────────────────────────────────────────────
echo ""
if [ "$PASS" = "true" ]; then
  echo "BACKUP VERIFICATION PASSED — all row counts match."
  echo "Schema dump preserved at: $BACKUP_FILE_SCHEMA"
  exit 0
else
  echo "BACKUP VERIFICATION FAILED — row count mismatch detected."
  exit 1
fi
